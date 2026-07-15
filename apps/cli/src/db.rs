use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use crate::{Args, Error, Result};

pub async fn open(args: &Args) -> Result<meetspace_db_core::Db> {
    let path = resolve_path(args)?;
    if !path.is_file() {
        return Err(Error::DatabaseNotFound(path));
    }

    meetspace_db_core::Db::connect_local_read_only(&path)
        .await
        .map_err(|error| Error::operation("open database", error.to_string()))
}

pub(crate) fn resolve_path(args: &Args) -> Result<PathBuf> {
    if let Some(path) = &args.db_path {
        return Ok(path.clone());
    }
    if let Some(base) = &args.base {
        return Ok(base.join("app.db"));
    }

    let data_dir = dirs::data_dir().ok_or_else(|| {
        Error::operation("resolve database path", "data directory is unavailable")
    })?;
    Ok(resolve_default_path(&data_dir))
}

fn resolve_default_path(data_dir: &Path) -> PathBuf {
    let command_name = std::env::args_os()
        .next()
        .and_then(|path| Path::new(&path).file_name().map(|name| name.to_owned()));
    resolve_default_path_for_command(data_dir, command_name.as_deref())
}

fn resolve_default_path_for_command(data_dir: &Path, command_name: Option<&OsStr>) -> PathBuf {
    let channel_identifier = match command_name.and_then(OsStr::to_str) {
        Some("meetspace-dev") => Some("com.meetspace.dev"),
        Some("meetspace-staging") => Some("com.meetspace.staging"),
        _ => None,
    };
    if let Some(identifier) = channel_identifier {
        return data_dir.join(identifier).join("app.db");
    }

    let current = data_dir.join("meetspace").join("app.db");
    if current.is_file() {
        return current;
    }

    let legacy = data_dir.join("meetspace").join("app.db");
    if legacy.is_file() {
        return legacy;
    }

    let identifier = data_dir.join("com.meetspace.stable").join("app.db");
    if identifier.is_file() {
        return identifier;
    }

    current
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_path_prefers_current_then_legacy_then_identifier() {
        let dir = tempfile::tempdir().unwrap();
        let current = dir.path().join("meetspace/app.db");
        let legacy = dir.path().join("meetspace/app.db");
        let identifier = dir.path().join("com.meetspace.stable/app.db");

        std::fs::create_dir_all(identifier.parent().unwrap()).unwrap();
        std::fs::write(&identifier, "").unwrap();
        assert_eq!(
            resolve_default_path_for_command(dir.path(), Some(OsStr::new("meetspace"))),
            identifier
        );

        std::fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        std::fs::write(&legacy, "").unwrap();
        assert_eq!(
            resolve_default_path_for_command(dir.path(), Some(OsStr::new("meetspace"))),
            legacy
        );

        std::fs::create_dir_all(current.parent().unwrap()).unwrap();
        std::fs::write(&current, "").unwrap();
        assert_eq!(
            resolve_default_path_for_command(dir.path(), Some(OsStr::new("meetspace"))),
            current
        );
    }

    #[test]
    fn default_path_targets_current_location_for_new_installs() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve_default_path_for_command(dir.path(), Some(OsStr::new("meetspace"))),
            dir.path().join("meetspace/app.db")
        );
    }

    #[test]
    fn channel_commands_target_their_channel_database() {
        let dir = tempfile::tempdir().unwrap();
        let stable = dir.path().join("meetspace/app.db");
        std::fs::create_dir_all(stable.parent().unwrap()).unwrap();
        std::fs::write(stable, "").unwrap();

        assert_eq!(
            resolve_default_path_for_command(dir.path(), Some(OsStr::new("meetspace-dev"))),
            dir.path().join("com.meetspace.dev/app.db")
        );
        assert_eq!(
            resolve_default_path_for_command(dir.path(), Some(OsStr::new("meetspace-staging"))),
            dir.path().join("com.meetspace.staging/app.db")
        );
    }
}
