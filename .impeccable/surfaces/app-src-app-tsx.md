---
version: 1
slug: "app-src-app-tsx"
primary_target: "app/src/App.tsx"
related_targets: ["app/src/styles.css", "app/src/StatusRow.tsx", "app/src/GpuActivity.tsx", "app/src/readiness.ts", "app/src/timing.ts", "app/src/PreviewControls.tsx"]
---

# Readiness window

Scope: app. Mode: Operate.
A single responsive screen for checking an Ollama GPU server. The centered Shambu header leads into combined readiness, connection age, four status rows, and GPU usage. Settings opens in place. Local host diagnostics and remote evidence remain distinct.

## Direction contract

THESIS: A pocket companion with the clarity of a handheld status instrument. One glance finds the broken link and the next useful action.
OWN-WORLD: Chalk white, green ink, fine rules, colored state dots, and compact hourly pills. The existing R2-D2 artwork and original forest identify both the native app and the page. The user-supplied nine-dot Tailscale PNG remains intact, with its white background blended into the surface. Keep source credits in the branding notes.
STORY: Choose this computer or a remote server in Settings, read the combined evidence, open a local companion app when useful, inspect installed models, and follow visible recovery guidance.
FIRST VIEWPORT: The native window defaults to 1120 by 760 and fits the usable display area. Preserve its operating-system title bar and controls. One column centers when content fits. A balanced three-track page header centers the Shambu name and existing icon, with Settings at the right. The icon is 48px normally and 42px compact. The readiness heading has combined status, relative age, and the Fluent refresh icon immediately below it. Settings explains which GPU server this device checks. The Tailscale endpoint strip precedes four continuous rows, followed by GPU usage.
FORM: The GPU icon and GPU usage heading align with other row titles. The body starts at the row-text inset and identifies Remote GPU: Nvidia Example GPU, or Details not linked. Twenty-five vertical pills, 30px high with fully rounded ends, sit in 36px-high buttons. The grid uses a 2px gap and 600px maximum width; 24h, 12h, and Now labels align beneath it. Filled pills mean Active, outlined pills mean Idle. Hover, touch, or keyboard focus reveals a tooltip such as 9 AM · Idle in device-local time. Preserve the rolling 24-hour window and partial end buckets.
BEHAVIOR: Green Connected requires the full fresh path and readiness evidence. Idle GPU use is healthy; Tailscale or forwarding problems show Connection issue, GPU or model problems show Needs attention, and stale or unverified evidence shows Check needed. Ollama failure shows Disconnected. Just now lasts until two minutes, followed by whole-minute ages. Automatic refresh runs every five minutes while visible and outside Settings; readings become stale at 330 seconds. App links open only on this device, with Tailscale only on Android. Keep failure guidance, recovery actions, model details, and private pairing clear.
FINISH: Use desktop vertical padding of 36px and horizontal padding of 56px, with 20px brand and readiness section bottom margins. Compact screens use 24px header margins. The GPU device label has 12px below it and its body ends with 16px padding. Check responsive views, combined readiness, recovery paths, keyboard behavior, and design records. The [UX state guide](../../docs/ux-states.md) owns the state matrix; the [native launcher guide](../../docs/native-launchers.md) owns platform launch limits.

The labeled synthetic-state selector and simulated recovery remain development-only. Preserve the approved artwork and functional hierarchy without adding decorative chart scaffolding.
