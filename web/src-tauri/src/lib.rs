//! Tauri 桌面壳（P0-2b 方案 i）：启动时拉起 Python sidecar 后端，退出时回收。
//!
//! sidecar = PyInstaller onefile（server/plos_backend.spec → plos-backend.exe），
//! 以 externalBin 随包分发；后端绑定 127.0.0.1:8100（见 server/backend_main.py），
//! 前端生产构建经 VITE_API_BASE 指向该地址（web/.env.desktop）。
//! 端口/.workspace 解析逻辑全部在 Python 侧，Rust 层只做 spawn/kill（薄壳原则）。
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// 持有 sidecar 子进程句柄，退出时 kill（防止孤儿后端进程）。
struct SidecarChild(std::sync::Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let (mut _rx, child) = app.shell().sidecar("plos-backend")?.spawn()?;
            app.manage(SidecarChild(std::sync::Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<SidecarChild>() {
                    if let Some(child) = state.0.lock().expect("sidecar lock").take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
