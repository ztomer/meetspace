use std::{fs, io::Write, path::PathBuf, process::Command};

#[cfg(target_os = "macos")]
const CLI_BYTES: &[u8] = include_bytes!("../../bin/llama-gbnf-validator-macos");

#[cfg(target_os = "linux")]
const CLI_BYTES: &[u8] = include_bytes!("../../bin/llama-gbnf-validator-linux");

#[cfg(not(target_os = "windows"))]
fn extract_cli_binary() -> std::io::Result<(PathBuf, tempfile::TempDir)> {
    let dir = tempfile::tempdir()?;
    let path = dir.path().join("llama-gbnf-validator");

    let mut file = fs::File::create(&path)?;
    file.write_all(CLI_BYTES)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&path)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&path, perms)?;
    }

    Ok((path, dir))
}

#[cfg(target_os = "windows")]
fn extract_cli_binary() -> std::io::Result<(PathBuf, tempfile::TempDir)> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "llama-gbnf-validator is not available on this platform",
    ))
}

pub struct Validator {
    path: PathBuf,
    dir: tempfile::TempDir,
}

impl Validator {
    pub fn new() -> anyhow::Result<Self> {
        let (path, dir) = extract_cli_binary()?;
        Ok(Self { path, dir })
    }

    pub fn validate(
        &self,
        grammar: impl AsRef<str>,
        input: impl AsRef<str>,
    ) -> anyhow::Result<bool> {
        let grammar_path = self.dir.path().join("grammar.txt");
        let input_path = self.dir.path().join("input.txt");
        fs::write(&grammar_path, grammar.as_ref())?;
        fs::write(&input_path, input.as_ref())?;

        let output = Command::new(&self.path)
            .args([
                grammar_path.to_string_lossy().as_ref(),
                input_path.to_string_lossy().as_ref(),
            ])
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "llama-gbnf-validator returned non-zero exit code"
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(!stdout.contains("invalid"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let validator = Validator::new().unwrap();
        assert!(validator.validate("root ::= \"a\"", "a").unwrap());
        assert!(!validator.validate("root ::= \"a\"", "b").unwrap());
    }

    #[test]
    fn parse_error() {
        let validator = Validator::new().unwrap();
        assert!(validator.validate("invalid", "a").is_err());
    }
}
