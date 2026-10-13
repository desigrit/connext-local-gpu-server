---
name: "Shambu"
description: "A quiet status instrument for a personal GPU server."
colors:
  green: "#3d6548"
  accent: "#dce9b9"
  action-hover: "#42614b"
  warning: "#946122"
  danger: "#a44236"
  surface: "#f7f8f5"
  ink: "#27382f"
  muted: "#657069"
  line: "#e0e5de"
  quiet-fill: "#eaf0e4"
  panel-fill: "#edf1e9"
  field-border: "#b9c5b6"
  mode-track: "#dfe6da"
  activity-border: "#75896f"
  activity-active: "#42684c"
  activity-selected: "#d2dfc3"
  activity-active-selected: "#284e36"
  activity-stale: "#74876d"
typography:
  headline:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.7px"
  title:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 750
  row-title:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
  body:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
  status:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  field:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  control:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 650
  metadata:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  gpu-name:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.5
  tooltip:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  app-hint:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 500
rounded:
  disclosure: "6px"
  field: "7px"
  control: "9px"
  container: "12px"
  dot: "50%"
  app-link: "4px"
  text-action: "3px"
spacing:
  "2": "2px"
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "36": "36px"
  "48": "48px"
  "56": "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 10px"
  button-quiet-hover:
    backgroundColor: "{colors.quiet-fill}"
    textColor: "{colors.ink}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  field-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  mode-navigation:
    backgroundColor: "{colors.mode-track}"
    rounded: "{rounded.control}"
    padding: "3px"
  mode-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.disclosure}"
  status-label:
    textColor: "{colors.green}"
    typography: "{typography.status}"
  server-strip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "12px 11px 12px 18px"
  connection-panel:
    backgroundColor: "{colors.panel-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "16px 20px 20px"
  status-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.row-title}"
    rounded: "{rounded.disclosure}"
    padding: "0 2px"
  gpu-history:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  gpu-name:
    textColor: "{colors.muted}"
    typography: "{typography.gpu-name}"
  hour-tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.tooltip}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
  hour-button:
    backgroundColor: "transparent"
    rounded: "{rounded.disclosure}"
    height: "32px"
    padding: "0"
  hour-dot:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dot}"
    size: "11px"
  hour-dot-active:
    backgroundColor: "{colors.activity-active}"
  hour-dot-selected:
    backgroundColor: "{colors.activity-selected}"
  hour-dot-active-selected:
    backgroundColor: "{colors.activity-active-selected}"
  hour-dot-stale-active:
    backgroundColor: "{colors.activity-stale}"
  hour-dot-compact:
    size: "8px"
  state-dot:
    backgroundColor: "currentColor"
    rounded: "{rounded.dot}"
    size: "6px"
  app-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.row-title}"
    rounded: "{rounded.app-link}"
    padding: "0"
  app-link-hint:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.app-hint}"
    rounded: "{rounded.disclosure}"
    padding: "7px 10px"
  recovery-action:
    backgroundColor: "transparent"
    textColor: "{colors.green}"
    typography: "{typography.status}"
    rounded: "{rounded.text-action}"
    height: "36px"
    padding: "0"
---

# Design System: Shambu

## Overview

**Creative North Star: "The Pocket Companion"**

Shambu is a quiet status instrument for a personal GPU server. A readiness sentence and its connection age lead into an external address and four aligned readings. Chalk surfaces, green ink, fine rules, and outlined hourly dots keep the interface light.

The dashboard forms one centered column with Settings beside the heading. Official app marks identify launch links, and a narrow GPU history strip closes the reading sequence. The native R2-D2 icon carries the product's character.

**Key Characteristics:**

- A light interface centered horizontally and vertically when space allows.
- A readiness heading with connection freshness directly beneath it.
- Four continuous status rows with colored dots and visible recovery guidance.
- Official app launch marks, real installed models, and compact hourly GPU dots.
- Native identity without a repeated dashboard wordmark or portrait.

This record follows `app/src/styles.css`, `app/src/App.tsx`, `app/src/StatusRow.tsx`, `app/src/GpuActivity.tsx`, and `app/src/timing.ts`. The frontmatter owns reusable tokens. `.impeccable/design.json` adds component examples, motion, breakpoint metadata, and narrative. The surface brief owns this dashboard's composition. See the [UX state guide](docs/ux-states.md) for complete state coverage.

## Colors

Chalk, green ink, and sage support the readings. GPU history uses outlined and filled dots on the same light canvas.

### Primary

- **Forest green** (`green`): healthy readings, connected status, links, carets, keyboard focus, and the inspected idle-dot edge.
- **Lichen** (`accent`): text selection.
- **Action green** (`action-hover`): hover on the primary settings action.

### Secondary

- **Amber** (`warning`): attention, unverified checks, pending connection, and stale notices.
- **Rust** (`danger`): failed checks, disconnected status, and unsuccessful launch feedback.

### Tertiary

- **Hour dot edge** (`activity-border`): the outlined Idle hour.
- **Active hour** (`activity-active`): a qualifying observed hour, with matching fill and edge.
- **Inspected idle hour** (`activity-selected`): the hovered or focused idle dot.
- **Inspected active hour** (`activity-active-selected`): the hovered or focused active dot, with matching fill and edge.
- **Earlier active hour** (`activity-stale`): active dots from earlier readings.

### Neutral

- **Chalk** (`surface`): the main canvas, supported native title-bar background, fields, idle dots, and tooltip text.
- **Green ink** (`ink`): primary text, filled settings actions, launch hints, and the hour tooltip.
- **Sage grey** (`muted`): supporting information, GPU name, idle checks, and stale readings.
- **Fine rule** (`line`): endpoint outlines and row dividers.
- **Quiet sage** (`quiet-fill`): quiet-control hover, selected Settings, and compact host-link prompt.
- **Panel sage** (`panel-fill`): settings and model-summary hover.
- **Field edge** (`field-border`): input and pairing-action outlines.
- **Mode track** (`mode-track`): the server-location control background.

**The Evidence Color Rule.** Use green for confirmed positive readiness, amber for attention or unverified checks, and rust for an error. Idle and stale readings use the muted neutral. Pair each state dot with a clear word.

**The Binary Hour Rule.** An hour dot has two data states, Active or Idle. A filled dot represents qualifying observed GPU activity while an Ollama model was in GPU memory. Empty and unmonitored hours display Idle.

## Typography

**Interface Font:** Manrope Variable, self-hosted through the app bundle. Segoe UI and a generic sans-serif are fallbacks.

The readiness sentence carries the page. Other text stays compact, with distinct size and weight changes rather than extra font families.

### Hierarchy

- **Headline:** `headline` defines the normal readiness sentence. Desktop increases it (29px); compact screens reduce it (24px) and ease tracking (-0.6px). Headings use balanced wrapping.
- **Title:** `title` is the settings heading.
- **Row title:** `row-title` labels checks and app links; compact screens reduce it (13px).
- **Body:** `body` supports recovery text and explanations. Recovery detail has a maximum measure (70ch), while field guidance is narrower (65ch).
- **Status:** `status` emphasizes readings such as Active or Not linked and the text recovery actions.
- **Field:** `field` defines editable values.
- **Controls and metadata:** `control` belongs to the primary form action; `metadata` supports labels and guidance. Quiet actions use larger text (12px); compact Settings uses smaller text (11px). Form labels use stronger weight (700).
- **GPU name:** `gpu-name` places a small semibold device name above the dots.
- **Hour tooltip:** `tooltip` uses tabular figures for the local hour, with a stronger state word (750).
- **App hint:** `app-hint` identifies the device-local launch action on hover or focus.

The endpoint and connection age use readable small text (12px) with tabular figures. Model names wrap; model sizes and status labels stay on one line.

**The Single Typeface Rule.** Use Manrope throughout the interface. Distinguish readings, controls, and explanations through size and weight, with tabular figures for times and model sizes.

## Layout

The centered frame supports a minimum CSS viewport width (320px). The root fills the viewport and uses a flex column; automatic margins center the dashboard along both axes when it fits. Longer recovery or settings content grows naturally and scrolls. Below desktop the frame has a maximum outer width (680px), horizontal padding (28px), and safe-area-aware top and bottom padding (36px minimum).

The native desktop window defaults to a centered landscape size (1120px by 760px), adjusted to the screen's usable area and scale. At the desktop breakpoint (800px), the frame expands (1000px maximum width), with equal top and bottom padding (48px) and horizontal padding (56px). The page and supported native title-bar surface share chalk. See the [native launcher and window guide](docs/native-launchers.md) for platform differences.

The dashboard keeps one column at every width. The heading, freshness line, and Settings form the header. The full-width status list follows the endpoint with a top margin (20px). The GPU history follows the list and any recovery or host-link guidance with a top margin (24px). Its device name sits above the dots with a bottom margin (12px).

At the compact breakpoint (480px), side padding becomes (22px), the header gap tightens (12px), and Settings retains its visible label. At the narrow breakpoint (359px), side padding reduces again (14px).

Status rows have a minimum height (62px) normally, (56px) on desktop, and (60px) on compact screens. Main buttons, inputs, and icon controls have a minimum target (44px); server-location choices have a minimum height (40px). Text recovery actions use a compact target height (36px). Hour buttons are equal-width cells with a fixed height (32px) and one shared keyboard entry point.

## Elevation & Depth

Borders define the endpoint, fields, and row divisions. Pale sage groups editable settings. GPU history sits directly on the main canvas.

The temporary hour tooltip uses green ink with chalk text and a small shadow (`0 4px 12px rgb(24 45 31 / .14)`). It floats above the inspected dot and stays within the strip through a clamped horizontal position. App launch hints use the same ink and chalk contrast without a shadow.

**The Flat Surface Rule.** Separate persistent surfaces with spacing, a fine border, or a tonal fill. Reserve the small soft shadow for the temporary hour tooltip.

## Shapes

Gently rounded corners distinguish fields, controls, and containers. Status dots are circles (6px). Hour dots are larger circles (11px normally, 8px compact) with a thin edge (1px). Each hour sits inside a transparent rounded button (6px radius). The hour tooltip uses the field radius (7px).

State words remain unboxed. App launch links have a small corner radius (4px), and text recovery actions use a smaller radius (3px).

Most operational symbols use Lucide SVG linework. Refresh uses Fluent `ArrowClockwise20Regular`. Ollama and Tailscale use their bundled official brand marks, while matching Qwen model names use the bundled Qwen mark. Preserve source artwork and its proportions.

## Components

### Header, Settings, and Freshness

The readiness sentence remains a heading with polite live status announcements. Settings opens in the document flow; closing it returns focus to the action. The selected action uses quiet sage. Keep its icon and visible label at every width.

Directly below the heading, show a colored connection dot and state, a hyphen, relative check time, and the icon-only Fluent refresh action. The compact line reads **Connected - Just now** when current and connected. Preserve the refresh target (44px) around its smaller icon (20px).

A reading younger than two minutes displays **Just now**. Older readings show whole minutes, such as **2 minutes ago**. Refresh runs automatically every five minutes while the app is visible and settings are closed. Stale evidence begins at the implemented threshold (330 seconds); a failed refresh also marks retained readings stale. Show the visible stale notice and **Refresh now** action.

During a check, the refresh icon rotates (0.9s, linear). Reduced-motion preferences disable animations, transitions, and smooth scrolling.

### Buttons and Fields

**Save & check** uses green ink, chalk text, and rounded control corners. Hover changes its fill over a short transition (140ms, ease-out). Quiet actions become ink on quiet sage; pairing adds the field-edge border. Disabled buttons reduce opacity (0.5) and use a default cursor.

Fields have visible labels, chalk fill, a fine field-edge border, and a minimum height (44px). Validation connects its message to the relevant field, focuses that field, and announces the message as an alert. Pairing remains within Settings, with the host key entered in a password field on remote devices.

Keyboard focus uses a green outline (2px) with visible separation (4px offset). Hour buttons place their outline at the cell edge (0 offset).

### External Endpoint Strip

A fine bordered strip groups the server name, the address other devices use, and copy. Host mode shows the discovered external Tailscale URL; remote mode shows the configured endpoint. When the address is unavailable, show its empty-state text and disable copy.

Names and URLs wrap anywhere. The endpoint stays selectable, and copy confirms completion through its icon and accessible status.

### Status Rows, Launch Links, and Recovery

Four checks share a continuous list. Healthy service checks read **Active**. Model library shows the available model count. A category or brand icon stays left, and each colored state dot sits beside its state word at the right.

The Ollama and Tailscale names form launch buttons with a small outward arrow. Hover underlines the label; hover and keyboard focus reveal **Open Ollama on this device** or **Open Tailscale on this device**. These actions open apps on the device running Shambu. Android offers Tailscale only. Use visible status or alert feedback for launch results.

Warning and error details remain visible beneath the reading. Include **Check again**, add **Edit address** for Ollama failures, and offer **Open Ollama** for an empty host model library on supported desktops. App-wide errors use **Try again**. A reserved chevron-width space preserves alignment on rows without a disclosure.

### Model Library

Only Model library opens a disclosure when actual installed models are available. List each real model name and formatted size. Qwen model names use their bundled brand mark; other models use the storage symbol. Model marks are compact (17px), names wrap, and sizes remain on one line with tabular figures.

Hover affects the summary, and opening it rotates the chevron (180 degrees over 160ms, ease-out). The sidecar preview uses illustrative generic models and their storage marks.

### GPU History Dots

The detected GPU name is the only visible label above the strip. When unavailable, show **GPU details not linked**. The strip spans the same width as the readings.

Twenty-five equal-width button cells cover the rolling 24-hour window, including partial hours at both ends. Each contains one outlined or filled circle. A filled dot means GPU use of at least 5% was observed while Ollama had a model in GPU memory. This is an estimate: other GPU work can contribute, and sampling can miss short activity. Empty and unmonitored hours display **Idle**.

Hovering or focusing an hour reveals a custom tooltip such as **9 AM · Idle**. Time follows the device's local zone without printing a zone abbreviation. Each hour also exposes a fuller time and state through its accessible name. Screen-reader guidance explains the estimate, Idle behavior, and keyboard navigation.

The strip has one tab stop, initially the most recent hour. Left and right arrows move between hours; Home and End move to the first and last hour. Escape dismisses the tooltip while keeping focus. Inspection changes the dot's fill and edge and scales it (1.25 times) over a short transition (140ms, ease-out).

Earlier readings use the muted active-dot fill and add an accessible reading-age explanation. The component preview illustrates an inspected hour with sample data; live time formatting and keyboard navigation belong to the application.

### Development State Preview

The browser development preview has a clearly labeled synthetic-state selector and **Simulate recovery** action. Its layout supports healthy, offline, Tailscale, forwarding, pairing, companion, CPU, empty-library, stale, and unlinked-remote states. Production builds omit the selector; the installed app uses live evidence. The [UX state guide](docs/ux-states.md) records the state and recovery paths.

### Native Identity

The product name remains Shambu. The larger R2-D2 foreground and original forest form the native app identity. Keep the icon legible at taskbar sizes. The approved artwork and source credits are maintained in the [branding notes](docs/branding.md); use the active derivatives rather than reconstructing the character or backdrop.

## Do's and Don'ts

### Do:

- **Do** use the implemented palette and self-hosted Manrope.
- **Do** keep connection state, age, and refresh directly under the readiness heading.
- **Do** pair status dots with words and keep the Settings label visible.
- **Do** keep failure guidance and recovery actions visible.
- **Do** show real model names and preserve the bundled app and Qwen marks.
- **Do** preserve hour inspection, keyboard focus, and reduced-motion behavior.
- **Do** keep character artwork in the native app identity.
- **Do** use generic examples and keep personal connection details out of public artifacts.

### Don't:

- **Don't** add a duplicate wordmark, portrait, or decorative hero above the dashboard.
- **Don't** give ordinary status rows empty disclosures or hide recovery guidance behind a click.
- **Don't** turn the readiness list into a grid of separate cards.
- **Don't** describe the binary history as request counts or exact inference attribution.
- **Don't** imply an app link opens a window on a remote computer.
- **Don't** use color alone to communicate a reading.
- **Don't** add shadows to persistent containers, glass, textures, or decorative data imagery.
- **Don't** use em dashes in product copy or public documentation.
