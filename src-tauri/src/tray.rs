use tauri::App;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use crate::window;

pub fn set_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
  let quit_i = MenuItemBuilder::new("退出").id("quit").build(app)?;

  let win_normal_submenu = MenuItemBuilder::new("普通模式")
    .id("normal")
    .build(app)?;

  let win_mini_submenu = MenuItemBuilder::new("迷你模式")
    .id("mini")
    .build(app)?;

  let menu = MenuBuilder::new(app)
    .items(&[&win_normal_submenu, &win_mini_submenu])
    .separator()
    .items(&[&quit_i])
    .build()?;

  // 创建一个 tray 图标
  let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(move |app, event| match event.id.as_ref() {
      "quit" => {
        app.exit(0);
      }
      "normal" => {
        if let Some(window) = app.get_webview_window("main") {
          window::go_normal(window);
        }
      }
      "mini" => {
        if let Some(window) = app.get_webview_window("main") {
          window::go_mini(window);
        }
      }
      _ => {
        println!("menu item {:?} not handled", event.id);
      }
    })
    .on_tray_icon_event(|tray, event| match event {
      TrayIconEvent::DoubleClick {
        button: MouseButton::Left,
        ..
      } => {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          window::go_normal(window);
        }
      }
      TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } => {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
      _ => (),
    })
    .build(app)?;

    Ok(())
}
