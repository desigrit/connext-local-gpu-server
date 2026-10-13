# Shambu artwork

The active icon is the approved pen sketch: a low safari hat, round nose, sweeping moustache and grin in green ink on ivory.

## Source and exports

- [Master artwork](../app/assets/shambu/shambu.png)
- [Generation prompt](concepts/shambu-stick-sketch-prompt.txt)
- [Source attribution](../app/assets/shambu/ORIGIN.txt)
- [Platform icon provenance](../app/src-tauri/icons/PROVENANCE.md)

The master is an unchanged copy of the approved concept. Tauri exports the Windows, macOS and Android icons from it. To regenerate them from the app folder:

```powershell
npm run tauri -- icon assets/shambu/shambu.png --output src-tauri/icons
Copy-Item -LiteralPath src-tauri/icons/128x128@2x.png -Destination src/assets/shambu-icon.png
```

The [Shikari Shambu archive](../app/assets/archive/shikari-shambu/README.md) preserves the original character references and credits. Shikari Shambu was created by Luis Fernandes and Vasant Halbe for Tinkle, published by Amar Chitra Katha Pvt. Ltd. Character and source-art rights remain with their respective holders.

Previous R2-D2 and matchbox studies remain in the repository as design history. They are no longer used in app icons.
