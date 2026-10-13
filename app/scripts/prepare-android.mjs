import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('../src-tauri/gen/android/app/src/main/AndroidManifest.xml', import.meta.url));
let manifest;
try { manifest = await readFile(manifestPath, 'utf8'); }
catch { throw new Error('Initialize Android first: npm run tauri -- android init'); }

// Ollama normally uses HTTP within the encrypted Tailscale network.
// The app has no web HTTP permission: the Rust backend performs only the three fixed GET probes.
if (/android:usesCleartextTraffic=/.test(manifest)) {
  manifest = manifest.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="true"');
} else {
  manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="true"');
}
// Connection addresses are device-local and should not go into Android cloud backups.
if (/android:allowBackup=/.test(manifest)) {
  manifest = manifest.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
} else {
  manifest = manifest.replace('<application', '<application android:allowBackup="false"');
}
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace('<application', '<uses-permission android:name="android.permission.INTERNET" />\n    <application');
}
await writeFile(manifestPath, manifest);
console.log('Android networking and local-only settings configured.');
