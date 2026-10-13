# Shambu artwork

The app icon is an AI-edited Shikari Shambu illustration: a small, broadly grinning Shambu peers through comically oversized binoculars while foreground bushes hide most of his body. A muted teal Indian jungle fills the circular backdrop. The binoculars extend beyond the circle onto a transparent canvas.

Shikari Shambu was created by Luis Fernandes and Vasant Halbe for Tinkle. The publisher is Amar Chitra Katha Pvt. Ltd. Its [2021 press release](https://www.issuewire.com/tinkles-shikari-shambu-turns-38-1700939605829767) identifies Savio Mascarenhas as the illustrator of Shambu's stories at that time; it does not give a separate artist credit for each attached image.

## Sources and editing

| Asset | Origin and role |
| --- | --- |
| [shikari-shambu-source.png](../app/assets/shikari-shambu-source.png) | Unchanged [ACK press illustration](https://s3-us-west-2.amazonaws.com/issuewireassets/primg/54661/shikari-shambu896408899.png), used as the character reference |
| [shambu-selfie-source.png](../app/assets/shambu-selfie-source.png) | Unchanged [ACK selfie illustration](https://s3-us-west-2.amazonaws.com/issuewireassets/primg/54661/shambu-takes-a-selfie1214805948.png), retained as an optional source variant |
| [shambu-jungle-reference.png](../app/assets/shambu-jungle-reference.png) | User-provided visual reference for the jungle palette, inked style, oversized optics, and toothy grin; no independent source URL was supplied |
| [shambu-binoculars.png](../app/assets/shambu-binoculars.png) | Final edited master, created with the built-in image generation tool on 12 October 2026 |
| [shambu-icon.png](../app/src/assets/shambu-icon.png) | 256-pixel app image rendered from the edited master |

The character pose, grin, binoculars, clothing colors, foliage, and circular composition were edited at the project owner's request. The final image is an AI-edited derivative, not an unchanged original ACK illustration. The two downloaded ACK PNGs and the user-provided reference remain unchanged.

The exact [base edit prompt](../app/assets/shambu-binoculars-base.prompt.txt) and [refinement prompt](../app/assets/shambu-binoculars.prompt.txt) are retained. The final master and derived PNG icons also embed the refinement prompt in PNG text metadata. This work used the built-in image generation tool, not the CLI fallback.

## Icon exports

Tauri's icon generator renders the edited master into the platform icons documented in [PROVENANCE.md](../app/src-tauri/icons/PROVENANCE.md). The app image is a copy of `128x128@2x.png`, suitable for its small header and larger mascot placement. [brand.ts](../app/src/brand.ts) keeps the name and active image reference together.

To rebuild the icon pixels, run this from `app`:

```powershell
npm run tauri -- icon assets/shambu-binoculars.png --output src-tauri/icons
Copy-Item -LiteralPath src-tauri/icons/128x128@2x.png -Destination src/assets/shambu-icon.png
```

Preserve the source attribution and embedded edit prompt when exporting new files. Keep the transparent margin and protruding binoculars; applying a circular mask to the complete image would remove the intended overlap.

## Rights and attribution

Shikari Shambu and the original illustrations remain the property of their respective rights holders, including Amar Chitra Katha Pvt. Ltd. This repository does not claim ownership, a redistribution license, or endorsement from Tinkle or Amar Chitra Katha. Attribution records the source; it does not grant reuse rights. No software license in this repository grants rights to the original character artwork or its edited derivatives.

## Original file checksums

SHA-256 of the unchanged downloaded files:

```text
shambu-selfie-source.png  62415FC5477E7D3B6FCC3EA85DB8571064BEA68803B72332B087ADAD08F420CD
shikari-shambu-source.png 2AA78028E5A67D65E1D442A53595B8483B9DC0CECE6A16CE0DAA6753B1E23AB4
```