# App updates

Shambu shows its installed version at the bottom left. A small **Update** pill appears when a newer release is available. Click it to download, then choose **Restart** on Windows or Mac. Android shows only its version number.

Checks run at launch and every six hours while the app is visible. A failed check retries after fifteen minutes, or when the device reconnects. Downloads start only when requested. Failed downloads offer **Retry**. Failed installations keep the verified download ready for another attempt. Quitting Shambu discards an uninstalled download; closing it to the tray keeps the download ready.

Version 1.0.2 is the first version with this feature. Earlier versions need one manual installation.

## Publishing updates

The regular release has four downloads: Windows x64, Windows ARM64, Apple Silicon Mac, and Android arm64. The separate [update feed](https://github.com/desigrit/shambu/releases/tag/update-feed) holds machine-readable metadata and the Mac archive needed by Tauri's updater. It is marked as a prerelease and never becomes the latest app release.

1. Bump the app version in the npm package and lockfile, Tauri configuration, and Shambu's Cargo package and lockfile. Add release notes, run the checks, and dispatch the app workflow with `release=true`.
2. Download all four platform artifacts and the Mac updater artifact into one local staging directory. Sign the Android APK using the existing Android release key.
3. Sign the three desktop updater files locally, using the original updater key:

   ```sh
   cd app
   node scripts/prepare-update.mjs 1.0.2 /path/to/staged-artifacts /private/path/to/shambu-updater.key
   cargo run -p shambu --example verify-update -- /path/to/staged-artifacts/latest.json /path/to/staged-artifacts
   ```

4. Verify package versions, architectures, and Android's certificate. Upload the four installers to the draft release and publish it.
5. Upload the versioned Mac `.app.tar.gz` to the `update-feed` release. Check that every URL in `latest.json` downloads the expected file. Upload `latest.json` last, replacing the previous manifest. Keep previously advertised packages available for clients that have already checked.

The updater private key remains in ignored, restricted local storage. Do not upload it to GitHub or CI. The public key is in `app/src-tauri/updater.pub` and the updater configuration. Back up the private key securely; existing installations trust that key for future updates.

Downloads use HTTPS and only this repository's release URLs. Tauri verifies desktop packages before installation. Signed version binding prevents a manifest from relabeling an older package as a newer update. Failed verification never enables installation. See the [Tauri updater documentation](https://v2.tauri.app/plugin/updater/).

## Development previews

Run the app's development server and add `?demo=healthy&update=available`. Replace `available` with `download-error`, `install-error`, or `unknown-size` to exercise recovery. These previews simulate downloads and never invoke an installer. The browser tests cover the staged download flow and recovery; native tests reject tampered bytes, mismatched versions, and foreign download URLs.
