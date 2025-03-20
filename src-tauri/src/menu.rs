use tauri::App;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri_plugin_opener::OpenerExt;
use crate::window;

pub fn set_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
  // https://ratulmaharaj.com/posts/tauri-custom-menu/
  // my custom settings menu item
  let github_menu = MenuItemBuilder::new("Github").id("github").build(app)?;

  // App Menu, 苹果默认
  let app_submenu = SubmenuBuilder::new(app, "App")
    .item(&github_menu)
    .separator()
    .quit()
    .build()?;

  // ... any other submenus
  // region 切换普通窗口和 mini 模式
  let win_normal_submenu = MenuItemBuilder::new("普通模式")
    .id("normal")
    .accelerator("CmdOrCtrl+N")
    .build(app)?;

  let win_mini_submenu = MenuItemBuilder::new("迷你模式")
    .id("mini")
    .accelerator("CmdOrCtrl+M")
    .build(app)?;

  let win_menus = SubmenuBuilder::new(app, "窗口")
    .item(&win_normal_submenu)
    .item(&win_mini_submenu)
    .build()?;
  // endregion

  let menu = MenuBuilder::new(app)
    .items(&[
      &app_submenu,
      &win_menus,
      // ... include references to any other submenus
    ])
    .build()?;

  // set the menu
  app.set_menu(menu)?;

  // set menu listener
  app.on_menu_event(move |app_handle: &tauri::AppHandle, event| {
    match event.id().0.as_str() {
      "github" => {
        let _ = app_handle
            .opener()
            .open_path("https://github.com/flora-studio/luoo-player", None::<&str>);
      }
      "normal" => {
        if let Some(window) = app_handle.get_webview_window("main") {
            window::go_normal(window);
        }
      }
      "mini" => {
        if let Some(window) = app_handle.get_webview_window("main") {
            window::go_mini(window);
        }
      }
      _ => {
        println!("unexpected menu event");
      }
    }
  });

  Ok(())
}
