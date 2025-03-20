use tauri::Manager;

mod window;
mod menu;
mod tray;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn click_go_normal(webview_window: tauri::WebviewWindow) {
  window::go_normal(webview_window);
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
    .invoke_handler(tauri::generate_handler![click_go_normal])
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    // 区分最小化到托盘与真正退出
    // https://github.com/tauri-apps/tauri/discussions/2684#discussioncomment-9434532
    // https://www.w3cschool.cn/tauri/tauri-prevents-application-shutdown.html
    .run(|_app_handle, event| match event {
      tauri::RunEvent::ExitRequested { code, api, .. } =>
      match code {
        Some(c) => {
          println!("Exit Request with code: {}", c);
        }
        _ => {
          println!("Exit Request with code: {:?} - prevented exit", code);
          api.prevent_exit();
        }
      }
      _ => (),
    });
}
