use chrono::{DateTime, Utc};
use owhisper_interface::Word2;

pub(super) struct SessionRow {
    pub id: String,
    pub created_at: String,
    pub title: String,
    pub raw_memo_html: String,
    pub enhanced_memo_html: Option<String>,
    pub words: Vec<Word2>,
    pub calendar_event_id: Option<String>,
    pub record_start: Option<DateTime<Utc>>,
    pub record_end: Option<DateTime<Utc>>,
}

impl SessionRow {
    pub(super) fn is_empty(&self) -> bool {
        is_session_content_empty(
            &self.raw_memo_html,
            self.enhanced_memo_html.as_deref(),
            self.words.is_empty(),
        )
    }
}

pub(super) fn is_session_content_empty(
    raw_memo_html: &str,
    enhanced_memo_html: Option<&str>,
    words_empty: bool,
) -> bool {
    let raw_empty = raw_memo_html.is_empty();
    let enhanced_empty = match enhanced_memo_html {
        Some(s) => s.is_empty(),
        None => true,
    };
    raw_empty && enhanced_empty && words_empty
}
