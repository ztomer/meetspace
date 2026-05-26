const COMMANDS: &[&str] = &["diarize_audio"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
