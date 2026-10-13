---
version: 1
slug: "app-src-app-tsx"
primary_target: "app/src/App.tsx"
related_targets: ["app/src/styles.css", "app/src/StatusRow.tsx", "app/src/GpuActivity.tsx", "app/src/timing.ts", "app/src/PreviewControls.tsx"]
---

# Readiness window

Scope: app. Mode: Operate.
A single responsive screen for checking an Ollama GPU server. Readiness and connection age lead, followed by four quiet status rows and hourly GPU dots. Settings opens in place. Local host diagnostics and remote evidence remain distinct.

## Direction contract

THESIS: A pocket companion with the clarity of a handheld status instrument. One glance finds the broken link and the next useful action.
OWN-WORLD: Chalk white, green ink, fine rules, colored state dots, and compact outlined activity dots. The supported native title bar shares the page color. A larger R2-D2 sits in front of the original forest in the native icon. Preserve the existing forest and foreground bushes. Keep source credits in the branding notes.
STORY: Choose this computer or a remote server in Settings, read the evidence, open a local companion app when useful, inspect installed models, and follow visible recovery guidance.
FIRST VIEWPORT: The native window defaults to 1120 by 760 and fits the usable display area. One column centers horizontally and vertically with balanced margins when content fits. The readiness heading has Connected - Just now and the Fluent refresh icon immediately below it. Settings remains visibly labeled beside the heading. The Tailscale endpoint strip precedes four continuous rows. Ollama and Tailscale use official marks and open the app on this device only; Android offers Tailscale only. Colored dots accompany the status words. Model Library expands into real model names, sizes, and appropriate Qwen marks. The GPU name and 25 hourly dots close the column.
FORM: Translate the approved handheld status instrument into a flat app. Hour dots are outlined when Idle and filled when Active, sized 11px normally and 8px on compact screens. Equal-width 32px-high buttons preserve hour inspection. Hover, touch, or keyboard focus reveals a custom tooltip such as 9 AM · Idle, using the device's local time without a zone abbreviation. Keep the rolling 24-hour window and its partial end buckets. Use the existing soft tooltip shadow only for temporary hour detail.
BEHAVIOR: Just now lasts until two minutes, followed by whole-minute ages. Automatic refresh runs every five minutes while visible and outside Settings; readings become stale at 330 seconds. Show failure guidance with Check again and relevant Edit address or app-launch actions. Keep private pairing in Settings. Production builds omit the synthetic-state selector; browser development previews cover healthy, offline, Tailscale, forwarding, pairing, companion, CPU, empty-library, stale, and unlinked-remote states with simulated recovery.
FINISH: Check the approved layout, recovery paths, keyboard behavior, responsive views, and design records. Every shipping raster must retain provenance. The [UX state guide](../../docs/ux-states.md) owns the state matrix; the [native launcher guide](../../docs/native-launchers.md) owns platform launch limits.

Use aligned readings, a clear failure direction, focused details, a strong hierarchy, and reachable controls. Keep the dashboard free of repeated branding and decorative chart scaffolding.
