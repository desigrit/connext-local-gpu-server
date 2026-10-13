use tauri::{LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

const PAGE_COLOR: tauri::window::Color = tauri::window::Color(247, 248, 245, 255);

fn fitted_size(
    work_area: PhysicalSize<u32>,
    frame: PhysicalSize<u32>,
    scale: f64,
) -> Option<LogicalSize<f64>> {
    if !scale.is_finite() || scale <= 0.0 || work_area.width == 0 || work_area.height == 0 {
        return None;
    }
    // Leave a small margin inside the usable screen area, including on HiDPI displays.
    let width = (f64::from(work_area.width.saturating_sub(frame.width)) / scale - 32.0).max(1.0);
    let height = (f64::from(work_area.height.saturating_sub(frame.height)) / scale - 32.0).max(1.0);
    Some(LogicalSize::new(width.min(1300.0), height.min(840.0)))
}

fn fit_to_screen(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let inner = window.inner_size()?;
    let outer = window.outer_size()?;
    let frame = PhysicalSize::new(
        outer.width.saturating_sub(inner.width),
        outer.height.saturating_sub(inner.height),
    );
    let area = monitor.work_area();
    let Some(size) = fitted_size(area.size, frame, scale) else {
        return Ok(());
    };
    window.set_min_size(Some(LogicalSize::new(
        size.width.min(360.0),
        size.height.min(580.0),
    )))?;
    window.set_size(size)?;
    let outer_width = size.width * scale + f64::from(frame.width);
    let outer_height = size.height * scale + f64::from(frame.height);
    window.set_position(PhysicalPosition::new(
        area.position.x + ((f64::from(area.size.width) - outer_width) / 2.0).round() as i32,
        area.position.y + ((f64::from(area.size.height) - outer_height) / 2.0).round() as i32,
    ))?;
    Ok(())
}

pub fn configure(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Geometry and decoration improvements must never prevent the app from opening.
    let _ = fit_to_screen(&window);
    let _ = window.set_background_color(Some(PAGE_COLOR));
    #[cfg(target_os = "macos")]
    {
        // Keeps the native title, traffic lights, dragging, and window controls.
        let _ = window.set_title_bar_style(tauri::TitleBarStyle::Transparent);
    }
    #[cfg(target_os = "windows")]
    if let Ok(handle) = window.hwnd() {
        tint_windows_caption(handle);
    }
}

#[cfg(target_os = "windows")]
fn tint_windows_caption(handle: windows::Win32::Foundation::HWND) {
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
    };
    // DWM COLORREF uses 0x00BBGGRR. Unsupported Windows versions retain native styling.
    let background: u32 = 0x00F5F8F7;
    let foreground: u32 = 0x002C332B;
    // SAFETY: Tauri owns a live HWND; both attributes expect a pointer to a
    // COLORREF-sized integer, valid for the duration of these synchronous calls.
    unsafe {
        let _ = DwmSetWindowAttribute(
            handle,
            DWMWA_CAPTION_COLOR,
            (&background as *const u32).cast(),
            std::mem::size_of::<u32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            handle,
            DWMWA_TEXT_COLOR,
            (&foreground as *const u32).cast(),
            std::mem::size_of::<u32>() as u32,
        );
    }
}

pub fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    #[cfg(target_os = "windows")]
    if matches!(
        event,
        tauri::WindowEvent::Focused(_) | tauri::WindowEvent::ThemeChanged(_)
    ) {
        if let Ok(handle) = window.hwnd() {
            tint_windows_caption(handle);
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (window, event);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_screen_keeps_the_requested_window_size() {
        let size = fitted_size(
            PhysicalSize::new(1920, 1040),
            PhysicalSize::new(16, 39),
            1.0,
        )
        .unwrap();
        assert_eq!((size.width, size.height), (1300.0, 840.0));
    }

    #[test]
    fn small_hidpi_work_area_fits_the_frame_and_controls() {
        let area = PhysicalSize::new(1280, 720);
        let frame = PhysicalSize::new(16, 48);
        let scale = 1.5;
        let size = fitted_size(area, frame, scale).unwrap();
        assert!(size.width < 1300.0 && size.height < 580.0);
        assert!(
            size.width * scale + f64::from(frame.width) <= f64::from(area.width) - 32.0 * scale
        );
        assert!(
            size.height * scale + f64::from(frame.height) <= f64::from(area.height) - 32.0 * scale
        );
    }

    #[test]
    fn unavailable_monitor_geometry_keeps_configured_defaults() {
        assert!(fitted_size(PhysicalSize::new(0, 0), PhysicalSize::new(0, 0), 1.0).is_none());
        assert!(fitted_size(PhysicalSize::new(1920, 1080), PhysicalSize::new(0, 0), 0.0).is_none());
    }
}
