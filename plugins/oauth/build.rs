const COMMANDS: &[&str] = &["start_pkce_flow"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
