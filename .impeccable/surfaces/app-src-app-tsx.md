---
version: 1
slug: "app-src-app-tsx"
primary_target: "app/src/App.tsx"
related_targets: ["app/src/styles.css", "app/src/StatusRow.tsx", "app/src/GpuActivity.tsx", "app/src/readiness.ts", "app/src/timing.ts", "app/src/PreviewControls.tsx"]
---

# Readiness window

Scope: app. Mode: Operate.
A single responsive screen for checking an Ollama GPU server. Readiness and connection age lead, with an icon-only Settings action on the right, followed by four status rows and GPU usage. Settings opens in place. Local host diagnostics and remote evidence remain distinct.

## Direction contract

THESIS: A pocket companion with the clarity of a handheld status instrument. One glance finds the broken link and the next useful action.
OWN-WORLD: Chalk white, green ink, fine rules, colored state dots, and thin hourly bars. The native R2-D2 icon carries the identity; the main viewport has no repeated Shambu label or mascot. The supplied nine-dot Tailscale PNG remains intact with its white background blended into the surface.
STORY: Choose this computer or a remote server in Settings, read the combined evidence, open a local companion app when useful, inspect installed models, and follow visible recovery guidance.
FIRST VIEWPORT: The 1120 by 760 native window fits the usable display and keeps operating-system controls. One column centers when it fits. Readiness, connection status, age, and refresh lead. Settings is icon-only on the top right, with an accessible name. The endpoint strip precedes four continuous rows and GPU usage. The settings panel ends with Cancel and Save aligned right.
FORM: The selected Slender direction has one straight-sided bar per hour, 6px wide and 30px high, with a 2px radius and 3px gap. Idle uses a pale fill, Active uses forest green. Twenty-five buckets cover the rolling 24-hour window including partial ends, with 24h, 12h, and Now beneath. Preserve hover, touch, local time tooltips, and roving keyboard focus. The development comparison offers six options using the same synthetic activity.
BEHAVIOR: Green Connected requires the full fresh path and readiness evidence. Idle GPU use is healthy; Tailscale or forwarding problems show Connection issue, GPU or model problems show Needs attention, and stale or unverified evidence shows Check needed. Ollama failure shows Disconnected. Just now lasts until two minutes, followed by whole-minute ages. Automatic refresh runs every five minutes while visible and outside Settings; readings become stale at 330 seconds. App links open only on this device, with Tailscale only on Android. Keep failure guidance, recovery actions, model details, and private pairing clear.
FINISH: Desktop padding is 36px vertically and 56px horizontally, with a 20px readiness margin. GPU content has a 33px inset, 12px device-label margin, and 16px bottom padding. Verify Cancel discards edits and Save persists them. Keep the [UX state guide](../../docs/ux-states.md) and [native launcher guide](../../docs/native-launchers.md) current.

The labeled synthetic-state selector and simulated recovery remain development-only. Preserve the approved artwork and functional hierarchy without adding decorative chart scaffolding.
