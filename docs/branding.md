# Shambu artwork

The app remains named Shambu. Its native icon shows a prominent, detailed R2-D2 facing right in a three-quarter view, entirely inside the forest circle. Segmented blue dome panels, an offset optical lens, a projecting sensor, body vents, and side legs make the character distinct. The existing droid is 25% larger than the earlier composition and sits ahead of the upper bushes, with the lowest original leaves overlapping its base. The original teal forest remains visible around it.

## Sources and composition

The [droid SVG](../app/assets/r2d2/r2d2-droid.svg) is editable vector artwork based on the [flat reference supplied by the project owner](../app/assets/archive/r2d2-reference/r2d2-flat-reference.png). The [reference notice](../app/assets/archive/r2d2-reference/README.md) records the unchanged file and its checksum. The original artist and source URL were not supplied. The final droid is new vector work, not an official Star Wars illustration or the earlier simplified LibreICONS glyph.

The forest comes from the [previous Shambu binoculars illustration](../app/assets/archive/shikari-shambu/shambu-binoculars.png). The final master embeds this source PNG unchanged. It keeps the visible original canopy outside the former character and binocular footprint, and preserves the original foreground leaves in two layers: upper leaves behind the droid and the lowest leaves in front of its base. The composition uses clipping and uniform scaling, preserving the source artwork instead of substituting a newly designed forest.

Replacing the former man and binoculars exposed previously hidden space. A [background-only image edit](../app/assets/r2d2/forest-subject-fill.png) repairs that occupied area. Its [exact prompt](../app/assets/r2d2/forest-subject-fill.prompt.txt) is preserved. The final SVG restricts this repair to the former subject footprint; the repaired PNG does not replace the visible original forest. The original [Shambu archive](../app/assets/archive/shikari-shambu/README.md) retains the supplied jungle reference, original ACK illustrations, earlier generation prompts, and attribution. Shikari Shambu was created by Luis Fernandes and Vasant Halbe for Tinkle, published by Amar Chitra Katha Pvt. Ltd.

[R2-D2](https://www.starwars.com/databank/r2-d2), Star Wars, Shikari Shambu, and the reference artwork remain the property of their respective rights holders. No character-rights license, license to the reference artwork, or Lucasfilm or ACK endorsement is claimed. The project's software license does not grant rights to these characters or source illustrations.

## Files and exports

- [shambu-r2d2.svg](../app/assets/r2d2/shambu-r2d2.svg): final editable composition, embedding the original source and masked repair.
- [r2d2-droid.svg](../app/assets/r2d2/r2d2-droid.svg): editable droid drawing.
- [shambu-icon.png](../app/src/assets/shambu-icon.png): 256-pixel application asset.
- [Platform icon provenance](../app/src-tauri/icons/PROVENANCE.md): Windows, macOS, and Android exports.
- [Taskbar-size preview](../app/assets/r2d2/taskbar-preview.png): actual 32- and 64-pixel renders on light and dark surfaces.
- [ORIGIN.txt](../app/assets/r2d2/ORIGIN.txt): source attribution, checksums, and modification details, also embedded in derived PNGs and included with distributed app packages.

To rebuild the icon pixels, run this from `app`:

```powershell
npm run tauri -- icon assets/r2d2/shambu-r2d2.svg --output src-tauri/icons
Copy-Item -LiteralPath src-tauri/icons/128x128@2x.png -Destination src/assets/shambu-icon.png
```

Preserve the attribution metadata and ship `ORIGIN.txt` with new exports. Keep the transparent canvas margins.

The retired LibreICONS glyph and its MIT notice are retained in a [source archive](../app/assets/archive/libreicons/README.md). They are not part of the current icon.
