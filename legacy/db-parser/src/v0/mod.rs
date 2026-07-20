mod convert;
mod session;

use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde_json::Value;

use crate::types::*;
use crate::{Error, Result};
use convert::{html_to_markdown, session_to_transcript};
use session::{SessionRow, is_session_content_empty};

const EXPECTED_TABLES: &[&str] = &["sessions", "humans", "organizations", "templates", "tags"];

struct SqliteSnapshot {
    _dir: tempfile::TempDir,
    path: PathBuf,
}

impl SqliteSnapshot {
    fn create(path: &Path) -> Result<Self> {
        let dir = tempfile::tempdir()?;
        let file_name = path.file_name().ok_or_else(|| {
            Error::InvalidData(format!(
                "v0 database path has no file name: {}",
                path.display()
            ))
        })?;
        let snapshot_path = dir.path().join(file_name);

        std::fs::copy(path, &snapshot_path)?;
        copy_sidecar_if_exists(path, dir.path(), file_name, "-wal")?;
        copy_sidecar_if_exists(path, dir.path(), file_name, "-shm")?;

        Ok(Self {
            _dir: dir,
            path: snapshot_path,
        })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

fn copy_sidecar_if_exists(
    source_db_path: &Path,
    snapshot_dir: &Path,
    file_name: &OsStr,
    suffix: &str,
) -> Result<()> {
    let source_path = source_db_path.with_file_name(sidecar_file_name(file_name, suffix));
    if !source_path.exists() {
        return Ok(());
    }

    let target_path = snapshot_dir.join(sidecar_file_name(file_name, suffix));
    std::fs::copy(source_path, target_path)?;
    Ok(())
}

fn sidecar_file_name(file_name: &OsStr, suffix: &str) -> std::ffi::OsString {
    let mut name = file_name.to_os_string();
    name.push(suffix);
    name
}

fn open(path: &Path) -> Result<Connection> {
    Ok(Connection::open(path)?)
}

pub fn validate(path: &Path) -> Result<()> {
    let conn = open(path)?;

    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")?
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    for expected in EXPECTED_TABLES {
        if !tables.iter().any(|t| t == *expected) {
            return Err(Error::InvalidData(format!(
                "v0 database missing required table: {}",
                expected
            )));
        }
    }

    if tables.len() < 10 {
        return Err(Error::InvalidData(format!(
            "v0 database expected 10+ tables, found {}",
            tables.len()
        )));
    }

    Ok(())
}

pub fn parse_from_sqlite(path: &Path) -> Result<Collection> {
    let snapshot = SqliteSnapshot::create(path)?;
    parse_from_snapshot(snapshot.path())
}

pub fn parse_stats_from_sqlite(path: &Path) -> Result<CollectionStats> {
    let snapshot = SqliteSnapshot::create(path)?;
    validate(snapshot.path())?;

    let conn = open(snapshot.path())?;
    normalize_empty_words(&conn)?;
    let (sessions_count, transcripts_count) = count_session_rows(&conn)?;

    let humans_count = count_rows(&conn, "SELECT COUNT(*) FROM humans")?;
    let organizations_count = count_rows(&conn, "SELECT COUNT(*) FROM organizations")?;
    let participants_count = count_rows(
        &conn,
        "SELECT COUNT(*)
         FROM session_participants sp
         JOIN sessions s ON s.id = sp.session_id
         JOIN humans h ON h.id = sp.human_id
         WHERE sp.deleted = FALSE OR sp.deleted IS NULL",
    )?;
    let templates_count = count_rows(&conn, "SELECT COUNT(*) FROM templates")?;
    let enhanced_notes_count = count_rows(
        &conn,
        "SELECT COUNT(*) FROM sessions WHERE COALESCE(enhanced_memo_html, '') <> ''",
    )?;

    Ok(CollectionStats {
        sessions_count,
        transcripts_count,
        humans_count,
        organizations_count,
        participants_count,
        templates_count,
        enhanced_notes_count,
    })
}

fn count_session_rows(conn: &Connection) -> Result<(usize, usize)> {
    let mut stmt = conn.prepare("SELECT raw_memo_html, enhanced_memo_html, words FROM sessions")?;
    let rows = stmt.query_map([], |row| {
        let raw_memo_html: String = row.get(0)?;
        let enhanced_memo_html: Option<String> = row.get(1)?;
        let words_json: String = row.get(2)?;
        let words: Vec<owhisper_interface::Word2> =
            serde_json::from_str(&words_json).unwrap_or_default();
        Ok((raw_memo_html, enhanced_memo_html, words))
    })?;

    let mut sessions_count = 0;
    let mut transcripts_count = 0;
    for row in rows {
        let (raw_memo_html, enhanced_memo_html, words) = row?;
        if !words.is_empty() {
            transcripts_count += 1;
        }
        if !is_session_content_empty(
            &raw_memo_html,
            enhanced_memo_html.as_deref(),
            words.is_empty(),
        ) {
            sessions_count += 1;
        }
    }

    Ok((sessions_count, transcripts_count))
}

fn count_rows(conn: &Connection, sql: &str) -> Result<usize> {
    let count: i64 = conn.query_row(sql, [], |row| row.get(0))?;
    Ok(count.max(0) as usize)
}

fn normalize_empty_words(conn: &Connection) -> Result<()> {
    // Older Char DBs can have `sessions.words` as NULL/empty, but the importer
    // expects a non-null JSON string.
    conn.execute(
        "UPDATE sessions SET words = '[]' WHERE words IS NULL OR words = ''",
        [],
    )?;
    Ok(())
}

fn parse_from_snapshot(path: &Path) -> Result<Collection> {
    validate(path)?;

    let conn = open(path)?;
    normalize_empty_words(&conn)?;

    let sessions_raw = list_sessions(&conn)?;

    let mut sessions = Vec::new();
    let mut transcripts = Vec::new();
    let mut participants = Vec::new();
    let mut enhanced_notes = Vec::new();
    let mut tags = Vec::new();
    let mut tag_mappings = Vec::new();

    for session in sessions_raw {
        let session_participants = list_session_participants(&conn, &session.id)?;
        for human in session_participants {
            participants.push(SessionParticipant {
                id: format!("{}-{}", session.id, human.id),
                user_id: String::new(),
                session_id: session.id.clone(),
                human_id: human.id,
                source: "imported".to_string(),
            });
        }

        if !session.words.is_empty() {
            transcripts.push(session_to_transcript(&session));
        }

        if let Some(ref enhanced_html) = session.enhanced_memo_html {
            if !enhanced_html.is_empty() {
                enhanced_notes.push(EnhancedNote {
                    id: format!("enhanced-{}", session.id),
                    user_id: String::new(),
                    session_id: session.id.clone(),
                    content: enhanced_html.clone(),
                    template_id: None,
                    position: 1,
                    title: String::new(),
                });
            }
        }

        let session_tags = list_session_tags(&conn, &session.id)?;
        for tag in session_tags {
            let tag_id = tag.id.clone();
            if !tags.iter().any(|t: &Tag| t.id == tag_id) {
                tags.push(Tag {
                    id: tag.id.clone(),
                    user_id: String::new(),
                    name: tag.name.clone(),
                });
            }
            tag_mappings.push(TagMapping {
                id: format!("{}-{}", tag.id, session.id),
                user_id: String::new(),
                tag_id: tag.id,
                session_id: session.id.clone(),
            });
        }

        if !session.is_empty() {
            let raw_md = if !session.raw_memo_html.is_empty() {
                Some(html_to_markdown(&session.raw_memo_html))
            } else {
                None
            };

            let enhanced_content = session
                .enhanced_memo_html
                .as_ref()
                .filter(|s| !s.is_empty())
                .map(|s| html_to_markdown(s));

            sessions.push(Session {
                id: session.id.clone(),
                user_id: String::new(),
                created_at: session.created_at.clone(),
                title: session.title,
                raw_md,
                enhanced_content,
                folder_id: None,
                event_id: session.calendar_event_id,
            });
        }
    }

    let humans = list_humans(&conn)?
        .into_iter()
        .map(|h| Human {
            id: h.id,
            user_id: String::new(),
            created_at: String::new(),
            name: h.full_name.unwrap_or_default(),
            email: h.email,
            org_id: h.organization_id,
            job_title: h.job_title,
            linkedin_username: h.linkedin_username,
        })
        .collect();

    let organizations = list_organizations(&conn)?
        .into_iter()
        .map(|o| Organization {
            id: o.id,
            user_id: String::new(),
            created_at: String::new(),
            name: o.name,
            description: o.description,
        })
        .collect();

    let templates = list_templates(&conn)?
        .into_iter()
        .map(|t| Template {
            id: t.id,
            user_id: String::new(),
            title: t.title,
            description: t.description,
            sections: t
                .sections
                .into_iter()
                .map(|s| TemplateSection {
                    title: s.title,
                    description: s.description,
                })
                .collect(),
            tags: t.tags,
            context_option: t.context_option,
        })
        .collect();

    Ok(Collection {
        sessions,
        transcripts,
        humans,
        organizations,
        participants,
        templates,
        enhanced_notes,
        tags,
        tag_mappings,
    })
}

// --- Direct SQL replacements for the legacy libsql ORM ---

struct Participant {
    id: String,
}

fn list_session_participants(conn: &Connection, session_id: &str) -> Result<Vec<Participant>> {
    let mut stmt = conn.prepare(
        "SELECT h.id FROM session_participants sp
         JOIN humans h ON h.id = sp.human_id
         WHERE sp.session_id = ? AND (sp.deleted = FALSE OR sp.deleted IS NULL)",
    )?;
    let rows = stmt.query_map([session_id], |row| Ok(Participant { id: row.get(0)? }))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

struct TagRow {
    id: String,
    name: String,
}

fn list_session_tags(conn: &Connection, session_id: &str) -> Result<Vec<TagRow>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name FROM tags_sessions ts
         JOIN tags t ON t.id = ts.tag_id
         WHERE ts.session_id = ?",
    )?;
    let rows = stmt.query_map([session_id], |row| {
        Ok(TagRow {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

struct HumanRow {
    id: String,
    full_name: Option<String>,
    email: Option<String>,
    organization_id: Option<String>,
    job_title: Option<String>,
    linkedin_username: Option<String>,
}

fn list_humans(conn: &Connection) -> Result<Vec<HumanRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, full_name, email, organization_id, job_title, linkedin_username FROM humans",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(HumanRow {
            id: row.get(0)?,
            full_name: row.get(1)?,
            email: row.get(2)?,
            organization_id: row.get(3)?,
            job_title: row.get(4)?,
            linkedin_username: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

struct OrgRow {
    id: String,
    name: String,
    description: Option<String>,
}

fn list_organizations(conn: &Connection) -> Result<Vec<OrgRow>> {
    let mut stmt = conn.prepare("SELECT id, name, description FROM organizations")?;
    let rows = stmt.query_map([], |row| {
        Ok(OrgRow {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

struct TemplateRow {
    id: String,
    title: String,
    description: String,
    sections: Vec<TemplateSection>,
    tags: Vec<String>,
    context_option: Option<String>,
}

fn parse_json_string_array(v: Value) -> Vec<String> {
    match v {
        Value::Array(items) => items
            .into_iter()
            .filter_map(|i| i.as_str().map(|s| s.to_string()))
            .collect(),
        _ => Vec::new(),
    }
}

fn list_templates(conn: &Connection) -> Result<Vec<TemplateRow>> {
    let mut stmt = conn
        .prepare("SELECT id, title, description, sections, tags, context_option FROM templates")?;
    let rows = stmt.query_map([], |row| {
        let sections_value: Value = row
            .get::<_, String>(3)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(Value::Array(vec![]));
        let sections: Vec<TemplateSection> = match sections_value {
            Value::Array(items) => items
                .into_iter()
                .filter_map(|i| serde_json::from_value(i).ok())
                .collect(),
            _ => Vec::new(),
        };
        let tags_value: Value = row
            .get::<_, String>(4)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(Value::Array(vec![]));
        let context_value: Option<Value> = row
            .get::<_, String>(5)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok());
        Ok(TemplateRow {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            sections,
            tags: parse_json_string_array(tags_value),
            context_option: context_value.and_then(|v| match v {
                Value::String(s) => Some(s),
                other => serde_json::to_string(&other).ok(),
            }),
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_sessions(conn: &Connection) -> Result<Vec<SessionRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, created_at, title, raw_memo_html, enhanced_memo_html, words, calendar_event_id, record_start, record_end
         FROM sessions",
    )?;
    let rows = stmt.query_map([], |row| {
        let words_json: String = row.get(5)?;
        let words: Vec<owhisper_interface::Word2> =
            serde_json::from_str(&words_json).unwrap_or_default();
        let parse_dt = |s: Option<String>| {
            s.and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                .map(|dt| dt.with_timezone(&Utc))
        };
        Ok(SessionRow {
            id: row.get(0)?,
            created_at: row.get(1)?,
            title: row.get(2)?,
            raw_memo_html: row.get(3)?,
            enhanced_memo_html: row.get(4)?,
            words,
            calendar_event_id: row.get(6)?,
            record_start: parse_dt(row.get(7)?),
            record_end: parse_dt(row.get(8)?),
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db(path: &Path) -> Connection {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, description TEXT);
            CREATE TABLE humans (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                is_user BOOLEAN,
                full_name TEXT,
                email TEXT,
                job_title TEXT,
                linkedin_username TEXT
            );
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                visited_at TEXT,
                user_id TEXT,
                title TEXT,
                raw_memo_html TEXT,
                enhanced_memo_html TEXT,
                conversations TEXT,
                words TEXT,
                calendar_event_id TEXT,
                record_start TEXT,
                record_end TEXT,
                pre_meeting_memo_html TEXT
            );
            CREATE TABLE session_participants (session_id TEXT, human_id TEXT, deleted BOOLEAN);
            CREATE TABLE templates (
                id TEXT PRIMARY KEY, user_id TEXT, title TEXT, description TEXT,
                sections TEXT, tags TEXT, context_option TEXT
            );
            CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT);
            CREATE TABLE tags_sessions (tag_id TEXT, session_id TEXT);
            "#,
        )
        .unwrap();
        conn
    }

    fn seed_rows(conn: &Connection) {
        conn.execute(
            "INSERT INTO organizations (id, name, description) VALUES ('org-1', 'Acme', 'Customer')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO humans (id, organization_id, is_user, full_name, email, job_title, linkedin_username)
             VALUES ('human-1', 'org-1', FALSE, 'Ada Lovelace', 'ada@example.com', 'Engineer', 'ada')",
            [],
        )
        .unwrap();
        conn.execute(
            r#"
            INSERT INTO sessions (
                id, created_at, visited_at, user_id, title, raw_memo_html, enhanced_memo_html, conversations, words
            ) VALUES (
                'session-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'human-1', 'Legacy meeting',
                '<p>Notes</p>', '<p>Summary</p>', '[]',
                '[{"text":"Hello","speaker":null,"confidence":1,"start_ms":1000,"end_ms":1500}]'
            )
            "#,
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO session_participants (session_id, human_id, deleted) VALUES ('session-1', 'human-1', FALSE)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO templates (id, user_id, title, description, sections, tags, context_option)
             VALUES ('template-1', 'human-1', 'Template', 'Description', '[]', '[]', NULL)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tags (id, name) VALUES ('tag-1', 'Important')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tags_sessions (tag_id, session_id) VALUES ('tag-1', 'session-1')",
            [],
        )
        .unwrap();
    }

    fn insert_session_candidate(
        conn: &Connection,
        id: &str,
        title: &str,
        raw_memo_html: &str,
        enhanced_memo_html: Option<&str>,
        words: &str,
    ) {
        conn.execute(
            r#"
            INSERT INTO sessions (
                id, created_at, visited_at, user_id, title, raw_memo_html, enhanced_memo_html, conversations, words
            ) VALUES (?1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'human-1', ?2, ?3, ?4, '[]', ?5)
            "#,
            (
                id,
                title,
                raw_memo_html,
                enhanced_memo_html,
                words,
            ),
        )
        .unwrap();
    }

    #[test]
    fn parse_stats_from_sqlite_counts_rows_without_full_import() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db.sqlite");
        let conn = setup_db(&path);
        seed_rows(&conn);

        let stats = parse_stats_from_sqlite(&path).unwrap();

        assert_eq!(stats.sessions_count, 1);
        assert_eq!(stats.transcripts_count, 1);
        assert_eq!(stats.humans_count, 1);
        assert_eq!(stats.organizations_count, 1);
        assert_eq!(stats.participants_count, 1);
        assert_eq!(stats.templates_count, 1);
        assert_eq!(stats.enhanced_notes_count, 1);
    }

    #[test]
    fn parse_stats_from_sqlite_uses_import_empty_session_filter() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db.sqlite");
        let conn = setup_db(&path);
        seed_rows(&conn);
        insert_session_candidate(&conn, "title-only", "Title only", "", None, "[]").unwrap();
        insert_session_candidate(&conn, "raw-empty-html", "", "<p></p>", None, "[]").unwrap();
        insert_session_candidate(&conn, "enhanced-empty-html", "", "", Some("<p></p>"), "[]")
            .unwrap();

        let stats = parse_stats_from_sqlite(&path).unwrap();
        let collection = parse_from_sqlite(&path).unwrap();

        assert_eq!(stats.sessions_count, collection.sessions.len());
        assert_eq!(stats.sessions_count, 1);
        assert_eq!(stats.transcripts_count, collection.transcripts.len());
        assert_eq!(stats.transcripts_count, 1);
    }

    #[test]
    fn parse_stats_from_sqlite_counts_only_joined_participants() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db.sqlite");
        let conn = setup_db(&path);
        seed_rows(&conn);

        conn.execute("PRAGMA foreign_keys = OFF", []).unwrap();
        conn.execute(
            "INSERT INTO session_participants (session_id, human_id, deleted) VALUES ('session-1', 'missing-human', FALSE)",
            [],
        )
        .unwrap();

        let stats = parse_stats_from_sqlite(&path).unwrap();
        let collection = parse_from_sqlite(&path).unwrap();

        assert_eq!(stats.participants_count, collection.participants.len());
        assert_eq!(stats.participants_count, 1);
    }

    #[test]
    fn parse_from_sqlite_does_not_mutate_source_empty_words() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db.sqlite");
        let conn = setup_db(&path);
        seed_rows(&conn);

        conn.execute("UPDATE sessions SET words = '' WHERE id = 'session-1'", [])
            .unwrap();

        parse_from_sqlite(&path).unwrap();

        let words: String = conn
            .query_row(
                "SELECT words FROM sessions WHERE id = 'session-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(words, "");
    }
}
