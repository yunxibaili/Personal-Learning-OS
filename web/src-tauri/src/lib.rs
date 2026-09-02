//! Tauri 桌面壳（P0-2b 方案 i）：启动时拉起 Python sidecar 后端，退出时回收。
//!
//! sidecar = PyInstaller onefile（server/plos_backend.spec → plos-backend.exe），
//! 以 externalBin 随包分发；后端绑定 127.0.0.1:8100（见 server/backend_main.py），
//! 前端生产构建经 `--mode desktop` 把 base 烘焙进 dist（web/src/lib/api.ts）。
//! 端口/workspace 解析逻辑全部在 Python 侧，Rust 层只做 spawn/kill（薄壳原则）。
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// 持有 sidecar 子进程句柄，退出时回收（防孤儿后端占库/占端口）。
struct SidecarChild(std::sync::Mutex<Option<CommandChild>>);

/// 按**进程树**强制终止（P0-3 实测教训）：onefile 引导进程只是直接子进程，
/// 真正的 Python 服务是孙进程；只 kill 直接子进程会留下孤儿，残留进程
/// 占着 8100/SQLite 会导致下次启动 sidecar 绑定失败。用系统 taskkill /T /F，
/// 零新依赖（CREATE_NO_WINDOW 防退出时控制台闪烁）。
#[cfg(windows)]
fn kill_tree(pid: u32) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

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
                        #[cfg(windows)]
                        kill_tree(child.pid());
                        let _ = child.kill();
                    }
                }
            }
        });
}
