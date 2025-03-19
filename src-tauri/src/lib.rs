use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{LogicalSize, PhysicalSize};
use tauri::WebviewWindow;
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri_plugin_opener::OpenerExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

static mut IS_MINI: bool = false;
static mut CURRENT_SIZE: PhysicalSize<u32> = PhysicalSize::new(1280, 720);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();

            // https://ratulmaharaj.com/posts/tauri-custom-menu/
            // my custom settings menu item
            let github_menu = MenuItemBuilder::new("Github")
                .id("github")
                .build(app)?;

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
                        let _ = app_handle.opener().open_path("https://github.com/flora-studio/luoo-player", None::<&str>);
                    }
                    "normal" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            go_normal(window);
                        }
                    }
                    "mini" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            go_mini(window);
                        }
                    }
                    _ => {
                        println!("unexpected menu event");
                    }
                }
            });

            // region tray

            let quit_i = MenuItemBuilder::new("退出")
                .id("quit")
                .build(app)?;

            let win_normal_submenu = MenuItemBuilder::new("普通模式")
                .id("normal")
//                 .accelerator("CmdOrCtrl+N")
                .build(app)?;

            let win_mini_submenu = MenuItemBuilder::new("迷你模式")
                .id("mini")
//                 .accelerator("CmdOrCtrl+M")
                .build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[
                    &win_normal_submenu,
                    &win_mini_submenu,
                ])
                .separator()
                .items(&[&quit_i])
                .build()?;



            // 创建一个 tray 图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "normal" => {
                            if let Some(window) = app.get_webview_window("main") {
                                go_normal(window);
                            }
                        }
                        "mini" => {
                            if let Some(window) = app.get_webview_window("main") {
                                go_mini(window);
                            }
                        }
                        _ => {
                          println!("menu item {:?} not handled", event.id);
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::DoubleClick {
                      button: MouseButton::Left,
                      ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            go_normal(window);
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

            // endregion

            // 注入 JavaScript
            main_window.eval(include_str!("../inject.js")).unwrap();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 切换为普通模式
fn go_normal(window: WebviewWindow) {
    unsafe {
        if !IS_MINI {
            return
        }
        IS_MINI = false;

        // 恢复上次的尺寸
        tauri::async_runtime::spawn(async move {
            toggle_window_size(window, false, CURRENT_SIZE).await;
        });
    }
}

// 切换为迷你模式
fn go_mini(window: WebviewWindow) {
    unsafe {
        if IS_MINI {
            return
        }
        IS_MINI = true;

        // 记住当前的尺寸
        let old_size = window.outer_size().unwrap();
        CURRENT_SIZE = old_size;
        tauri::async_runtime::spawn(async move {
            toggle_window_size(window, true, old_size).await;
        });
    }
}

// 窗口样式切换
async fn toggle_window_size(window: WebviewWindow, mini: bool, new_size: PhysicalSize<u32>) {
    if mini {
        window.set_always_on_top(true).unwrap();
        window.set_decorations(false).unwrap();
        window.set_resizable(false).unwrap();
        window.hide_menu().unwrap();
        // 要放在 set_decorations 和 hide_menu 之后，否则 windows 会留下一块空白区域
        window.set_size(LogicalSize::new(400.0, 80.0)).unwrap();
        window.eval("window.setMiniMode(true)").unwrap();
    } else {
        window.set_always_on_top(false).unwrap();
        window.set_decorations(true).unwrap();
        window.set_resizable(true).unwrap();
        window.show_menu().unwrap();
        window.set_size(new_size).unwrap();
        window.eval("window.setMiniMode(false)").unwrap();
    }
}
