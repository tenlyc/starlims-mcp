import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFileManifest, writeJson } from './vendor-lib.mjs';

const indexPath = resolve('vendor/index.json');
const index = JSON.parse(await readFile(indexPath, 'utf8'));

for (const entry of index.snapshots) {
  const root = resolve('vendor', entry.path);
  const metadataPath = resolve(root, 'SNAPSHOT.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const manifest = await buildFileManifest(root);

  await writeFile(resolve(root, 'FILES.sha256'), manifest.content, 'utf8');
  metadata.fileCount = manifest.files;
  metadata.totalBytes = manifest.bytes;
  metadata.filesManifestSha256 = manifest.digest;
  entry.fileCount = manifest.files;
  entry.totalBytes = manifest.bytes;
  entry.filesManifestSha256 = manifest.digest;
  await writeJson(metadataPath, metadata);
}

index.generatedAt = new Date().toISOString();
await writeJson(indexPath, index);
console.log(`Refreshed ${index.snapshots.length} canonical vendor manifests.`);
