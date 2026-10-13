import { readFile, copyFile, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const [version, directoryArg, keyArg] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || !directoryArg || !keyArg) {
  throw new Error('Usage: node scripts/prepare-update.mjs VERSION ARTIFACT_DIRECTORY PRIVATE_KEY_FILE');
}
const directory = resolve(directoryArg);
const keyPath = resolve(keyArg);
const publicKey = (await readFile(new URL('../src-tauri/updater.pub', import.meta.url), 'utf8')).trim();
if ((await readFile(keyPath + '.pub', 'utf8')).trim() !== publicKey) {
  throw new Error('Use the signing key that matches the public key embedded in Shambu.');
}
if (JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version !== version) {
  throw new Error('The release version must match the app version.');
}
const macName = `Shambu-${version}-Mac-Apple-Silicon.app.tar.gz`;
await copyFile(join(directory, 'Shambu-Mac-Apple-Silicon.app.tar.gz'), join(directory, macName));
const artifacts = {
  'windows-x86_64': 'Shambu-Windows-x64-Setup.exe',
  'windows-aarch64': 'Shambu-Windows-ARM64-Setup.exe',
  'darwin-aarch64': macName,
};
const cli = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
const platforms = {};
for (const [platform, name] of Object.entries(artifacts)) {
  const path = join(directory, name);
  const result = spawnSync(process.execPath, [cli, 'signer', 'sign', '--private-key-path', keyPath, '--app-version', version, path], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`Signing failed for ${basename(path)}.`);
  platforms[platform] = {
    signature: (await readFile(path + '.sig', 'utf8')).trim(),
    url: `https://github.com/desigrit/shambu/releases/download/${platform === 'darwin-aarch64' ? 'update-feed' : `v${version}`}/${name}`,
  };
  console.log(`Signed ${platform} ${version}`);
}
await writeFile(join(directory, 'latest.json'), JSON.stringify({ version, notes: `Shambu ${version}`, pub_date: new Date().toISOString(), platforms }, null, 2) + '\n');
console.log('Prepared latest.json. Verify the files, publish the installers, then publish the feed last.');
