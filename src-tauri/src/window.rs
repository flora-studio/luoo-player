use tauri::WebviewWindow;
use tauri::{LogicalSize, PhysicalSize};

static mut IS_MINI: bool = false;
static mut CURRENT_SIZE: PhysicalSize<u32> = PhysicalSize::new(1280, 720);

// 切换为普通模式
pub fn go_normal(window: WebviewWindow) {
  unsafe {
    if !IS_MINI {
      return;
    }
    IS_MINI = false;

    // 恢复上次的尺寸
    tauri::async_runtime::spawn(async move {
      toggle_window_size(window, false, CURRENT_SIZE).await;
    });
  }
}

// 切换为迷你模式
pub fn go_mini(window: WebviewWindow) {
  unsafe {
    if IS_MINI {
      return;
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
