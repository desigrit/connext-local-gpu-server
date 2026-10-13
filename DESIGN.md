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
  activity-idle: "#e8ede4"
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
rounded:
  disclosure: "6px"
  field: "7px"
  control: "9px"
  container: "12px"
  dot: "50%"
  hour: "4px"
  hour-compact: "3px"
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
  hour-column:
    backgroundColor: "{colors.activity-idle}"
    rounded: "{rounded.hour}"
    height: "32px"
    padding: "0"
  hour-column-active:
    backgroundColor: "{colors.activity-active}"
  hour-column-selected:
    backgroundColor: "{colors.activity-selected}"
  hour-column-active-selected:
    backgroundColor: "{colors.activity-active-selected}"
  hour-column-stale-active:
    backgroundColor: "{colors.activity-stale}"
  hour-column-compact:
    rounded: "{rounded.hour-compact}"
    height: "30px"
  hour-tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.tooltip}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
---

# Design System: Shambu

## Overview

**Creative North Star: "The Pocket Companion"**

Shambu is a quiet status instrument for a personal GPU server. The readiness sentence, external connection address, and four aligned readings establish the hierarchy. Chalk surfaces, green ink, and fine rules keep the interface light. A narrow GPU history strip follows the readings at the same width.

The native R2-D2 app icon carries the character of the product. The dashboard begins directly with the readiness message and Connection control. Its personality comes from concise language, careful spacing, and the simple rhythm of hourly activity columns.

**Key Characteristics:**

- A light interface with one continuous column.
- A readiness header, external endpoint strip, and four aligned status rows.
- Visible recovery guidance and a model-library disclosure grounded in actual data.
- A narrow rolling 24-hour GPU strip with local-time hover and focus details.
- Native identity without a repeated dashboard wordmark or portrait.

This record follows `app/src/styles.css`, `app/src/App.tsx`, and `app/src/GpuActivity.tsx`, checked against the desktop and mobile captures. The frontmatter owns reusable tokens. `.impeccable/design.json` adds component examples, motion, breakpoint metadata, and narrative. The surface brief owns this dashboard's composition.

## Colors

Chalk, green ink, and sage support the readings. GPU history uses green fills on the same light canvas.

### Primary

- **Forest green** (`green`): healthy readings, connected status, links, carets, keyboard focus, and the inspected idle-hour edge.
- **Lichen** (`accent`): text selection.
- **Action green** (`action-hover`): hover on the primary settings action.

### Secondary

- **Amber** (`warning`) and **rust** (`danger`): attention and failed checks, paired with explanatory text.

### Tertiary

- **Idle hour** (`activity-idle`) and **hour edge** (`activity-border`): empty or unmonitored hourly columns.
- **Active hour** (`activity-active`): a qualifying observed hour, with matching fill and edge.
- **Inspected idle hour** (`activity-selected`): the hovered or focused idle column.
- **Inspected active hour** (`activity-active-selected`): the hovered or focused active column, with matching fill and edge.
- **Earlier active hour** (`activity-stale`): active columns from earlier readings.

### Neutral

- **Chalk** (`surface`): the main canvas, fields, and tooltip text.
- **Green ink** (`ink`): primary text, filled settings actions, and the hour tooltip.
- **Sage grey** (`muted`): supporting information, the GPU name, and unverified states.
- **Fine rule** (`line`): endpoint outlines and row dividers.
- **Quiet sage** (`quiet-fill`): quiet-control hover, selected Connection, and compact host-link prompt.
- **Panel sage** (`panel-fill`): connection settings and model-summary hover.
- **Field edge** (`field-border`): input and pairing-action outlines.
- **Mode track** (`mode-track`): the server-location control background.

**The Evidence Color Rule.** Use green for a confirmed positive readiness state, amber for attention, and rust for an error. Unknown, idle, and stale readiness states use the muted neutral. Pair each reading with words and a drawn state mark.

**The Binary Hour Rule.** An activity column has two visual states, Active or Idle. A filled hour represents a qualifying observed GPU sample while an Ollama model was in GPU memory. Empty and unmonitored hours display Idle.

## Typography

**Interface Font:** Manrope Variable, self-hosted through the app bundle. Segoe UI and a generic sans-serif are fallbacks.

The readiness sentence carries the page. Other text stays compact, with distinct size and weight changes rather than extra font families.

### Hierarchy

- **Headline:** `headline` defines the normal readiness sentence. Desktop increases it (29px); compact screens reduce it (24px) and ease tracking (-0.6px). Headings use balanced wrapping.
- **Title:** `title` is the settings heading.
- **Row title:** `row-title` labels checks; compact screens reduce it (13px).
- **Body:** `body` supports recovery text and explanations. Recovery detail has a maximum measure (70ch), while field guidance is narrower (65ch).
- **Status:** `status` emphasizes readings such as Active or Not linked.
- **Field:** `field` defines editable values.
- **Controls and metadata:** `control` belongs to the primary form action; `metadata` supports labels and guidance. Quiet actions use larger text (12px), and form labels use stronger weight (700).
- **GPU name:** `gpu-name` places a small semibold device name above the strip.
- **Hour tooltip:** `tooltip` uses tabular figures for the local hour and time zone, with a stronger state word (750).

The endpoint and connection footer use readable small text (12px) with tabular figures. Model names wrap; model sizes and status labels stay on one line.

**The Single Typeface Rule.** Use Manrope throughout the interface. Distinguish readings, controls, and explanations through size and weight, with tabular figures for times and model sizes.

## Layout

The centered frame scrolls normally and supports a minimum CSS viewport width (320px). Below desktop it has a maximum outer width (680px), side padding (28px), and safe-area-aware top and bottom spacing.

The native desktop window opens at the established landscape size (1040px by 760px). At the desktop breakpoint (800px), the frame expands (980px maximum width), with top and horizontal padding (40px) and bottom padding (24px). The readiness sentence sits opposite Connection.

The dashboard keeps one column at every width. The full-width status list follows the endpoint with a top margin (20px). The GPU history strip follows the list and any host-link guidance with a top margin (24px). Its device name sits above the columns with a bottom margin (12px).

At the compact breakpoint (480px), side padding becomes (22px), the header gap tightens (12px), and Connection becomes icon-only while preserving its accessible name. At the narrow breakpoint (359px), side padding reduces again (14px).

Status rows have a minimum height (62px) normally, (56px) on desktop, and (60px) on compact screens. The footer combines connection state, relative time, and refresh in one line, with top padding (18px normally, 20px desktop). Main buttons, inputs, and icon controls have a minimum target (44px); server-location choices have a minimum height (40px). The narrow hour buttons use the strip height (32px normally, 30px compact) and share one keyboard entry point.

## Elevation & Depth

Borders define the endpoint, fields, and row divisions. Pale sage groups editable settings. GPU history sits directly on the main canvas.

The temporary hour tooltip uses green ink with chalk text and a small shadow (`0 4px 12px rgb(24 45 31 / .14)`). It floats above the inspected column and stays within the strip through a clamped horizontal position.

**The Flat Surface Rule.** Separate persistent surfaces with spacing, a fine border, or a tonal fill. Reserve the small soft shadow for the temporary hour tooltip.

## Shapes

Gently rounded corners distinguish fields, controls, and containers. Hour columns use a small radius (4px normally, 3px compact) and a thin edge (1px), with equal heights throughout a given layout. The tooltip uses the field radius (7px).

Status dots are small circles (5px); the connected footer dot is larger (6px). State words remain unboxed.

Most operational symbols use Lucide SVG linework. Refresh uses Fluent `ArrowClockwise20Regular`. Preserve the implemented thin drawn appearance.

## Components

### Header and Connection

The readiness sentence is a polite live status region. Connection opens settings in the document flow; closing settings returns focus to the action. The selected action uses quiet sage.

Compact layouts hide only the visible Connection text, preserving its icon target and accessible label.

### Buttons and Fields

**Save & check** uses green ink, chalk text, and rounded control corners. Hover changes its fill over a short transition (140ms, ease-out). Quiet actions become ink on quiet sage; pairing adds the field-edge border. Disabled buttons reduce opacity (0.5) and use a default cursor.

Fields have visible labels, chalk fill, a fine field-edge border, and a minimum height (44px). Validation connects its message to the relevant field, focuses that field, and announces the message as an alert.

Keyboard focus uses a green outline (2px) with visible separation (4px offset). Hour buttons tighten the offset (3px).

### External Endpoint Strip

A fine bordered strip groups the server name, the address other devices use, and copy. Host mode shows the discovered external Tailscale URL; remote mode shows the configured endpoint. When the address is unavailable, show its empty-state text and disable copy.

Names and URLs wrap anywhere. The endpoint stays selectable, and copy confirms completion through its icon and accessible status.

### Status Rows and Model Library

Four checks share a continuous list. Healthy service checks read **Active**. Model library shows the available model count. The category icon stays left, the label expands, and the state aligns right.

Ordinary rows are static. Warning and error details, including recovery guidance, stay visible beneath the reading. A reserved chevron-width space keeps alignment consistent.

Only Model library opens a disclosure when actual installed models are available. List each real model name and formatted size. Names wrap; sizes remain on one line with tabular figures. Hover affects the summary, and opening it rotates the chevron (180 degrees over 160ms, ease-out).

### GPU History Strip

The detected GPU name is the only visible label above the strip. When unavailable, show **GPU details not linked**. The strip spans the same width as the readings.

Twenty-five equal-width hour buckets cover the rolling 24-hour window, including the partial hours at both ends. Columns have a fixed height (32px normally, 30px compact) and gaps (5px normally, 3px compact). A filled column means GPU use of at least 5% was observed while Ollama had a model in GPU memory. This is an estimate: other GPU work can contribute, and sampling can miss short activity. Empty and unmonitored hours display **Idle**.

Hovering or focusing an hour reveals a custom tooltip with local time, the device's time zone, and **Active** or **Idle**, for example **9am PST: Idle**. Each hour also exposes its fuller time and state through an accessible name. Screen-reader guidance explains the estimate, Idle behavior, and keyboard navigation.

The strip has one tab stop, initially the most recent hour. Left and right arrows move between hours; Home and End move to the first and last hour. Escape dismisses the tooltip while keeping focus. Inspection changes the column fill and edge over a short transition (140ms, ease-out).

Earlier readings use the muted active-hour fill and add an accessible reading-age explanation. The component preview illustrates a selected hour with sample data; live time formatting and keyboard navigation belong to the application.

### Connection Footer and Motion

The footer combines a colored dot and connection word, an interpunct, relative time such as **Just now**, and a Fluent refresh action. Keep a generous target (44px) around the small icon (20px).

Refresh runs automatically every two minutes while the app is visible and connection settings are closed. Stale evidence begins at the implemented threshold (150 seconds). During a check, the refresh icon rotates (0.9s, linear). Reduced-motion preferences disable animations, transitions, and smooth scrolling.

### Native Identity

The product name remains Shambu. R2-D2 supplies the native app identity without a dashboard portrait or wordmark. Keep the icon legible at taskbar sizes. The approved artwork and source credits are maintained in `docs/branding.md`; use the active asset derivatives rather than reconstructing the character or backdrop.

## Do's and Don'ts

### Do:

- **Do** use the implemented palette and self-hosted Manrope.
- **Do** lead with the readiness sentence and external connection address.
- **Do** use Active consistently for healthy service checks.
- **Do** keep failure details visible and reserve model expansion for actual installed models.
- **Do** place the GPU name above a full-width 24-hour strip with accessible hour descriptions and hover or focus details.
- **Do** preserve keyboard focus, accessible control names, and reduced-motion behavior.
- **Do** keep character artwork in the native app identity.
- **Do** use generic examples and keep personal connection details out of public artifacts.

### Don't:

- **Don't** add a duplicate wordmark, portrait, or decorative hero above the dashboard.
- **Don't** give ordinary status rows empty disclosures or hide recovery guidance behind a click.
- **Don't** turn the readiness list into a grid of separate cards.
- **Don't** describe the binary history as request counts or exact inference attribution.
- **Don't** use color alone to communicate a reading.
- **Don't** add shadows to persistent containers, glass, textures, or decorative data imagery.
- **Don't** use em dashes in product copy or public documentation.
