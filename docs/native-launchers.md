# Native app links and window appearance

The Tailscale and Ollama buttons open apps on the device running Shambu. Checking a remote GPU PC does not give Shambu a way to open a window on that PC.

The frontend calls openCompanionApp('tailscale' | 'ollama'). It resolves with a message describing the launch request, or rejects with an Error containing a next step. A successful request means the operating system accepted it; the app may use a tray or menu-bar icon instead of a window.

| Platform | Tailscale | Ollama |
| --- | --- | --- |
| Windows | Opens the installed tailscale-ipn.exe GUI in a standard Program Files folder. | Opens ollama app.exe from the current user's default installation or a standard Program Files folder. |
| macOS | Launch Services opens the installed Tailscale app. | Launch Services opens the installed Ollama app on this Mac. |
| Android | Opens Tailscale's device list through its navigation link. Update Tailscale or open it manually if an older version does not handle the link. | The desktop app is unavailable. Open Ollama on the GPU PC. |
| Browser preview | Use the installed Shambu app to open other apps. | Use the installed Shambu app to open other apps. |

A custom Windows installation outside those folders must be opened from Start. Shambu accepts only the two app identifiers above. It does not accept executable paths, arguments, shell commands, or URLs from the interface. On Android, the opener plugin has no frontend permissions and automatic link handling is disabled. The fixed Tailscale link only navigates inside the app.

Shambu defaults to a centered 1120 by 760 logical-pixel window, with smaller initial dimensions when needed to fit the screen's usable area and display scaling. Native window controls remain available. Windows 11 uses the page color for the native caption; earlier Windows versions retain their supported native styling. macOS uses a transparent native title bar over the same window background.

Sources: [Ollama's Windows installation layout](https://docs.ollama.com/windows), [Ollama GUI executable name](https://github.com/ollama/ollama/blob/main/app/ollama.iss), [Tailscale Android navigation routes](https://github.com/tailscale/tailscale-android/blob/main/android/src/main/java/com/tailscale/ipn/ui/util/DeepLinkNavigator.kt), [Windows caption-color support](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute), [Tauri native title-bar customization](https://v2.tauri.app/learn/window-customization/).