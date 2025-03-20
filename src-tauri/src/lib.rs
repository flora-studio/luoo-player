use tauri::Manager;

mod window;
mod menu;
mod tray;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {

            let _ = menu::set_menu(app);
            let _ = tray::set_tray(app);

            // 注入 JavaScript
            let main_window = app.get_webview_window("main").unwrap();
            main_window.eval(include_str!("../inject.js")).unwrap();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
