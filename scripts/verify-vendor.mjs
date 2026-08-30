import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFileManifest, sha256 } from './vendor-lib.mjs';

const index = JSON.parse(await readFile(resolve('vendor/index.json'), 'utf8'));
assert.equal(index.schemaVersion, 1);
assert.ok(Array.isArray(index.snapshots) && index.snapshots.length > 0, 'No vendor snapshots are indexed.');

for (const entry of index.snapshots) {
  const root = resolve('vendor', entry.path);
  const metadata = JSON.parse(await readFile(resolve(root, 'SNAPSHOT.json'), 'utf8'));
  const manifest = await buildFileManifest(root);
  const savedManifest = await readFile(resolve(root, 'FILES.sha256'), 'utf8');
  assert.equal(savedManifest, manifest.content, `${entry.path} contains changed, missing, or untracked files.`);
  assert.equal(metadata.sourceCommit, entry.sourceCommit);
  assert.equal(metadata.fileCount, manifest.files);
  assert.equal(metadata.totalBytes, manifest.bytes);
  assert.equal(metadata.filesManifestSha256, manifest.digest);
  assert.equal(entry.filesManifestSha256, manifest.digest);
  assert.match(await sha256(resolve(root, metadata.includedPaths.find((path) => /LICENSE/i.test(path)))), /^[0-9a-f]{64}$/);
}

console.log(`Verified ${index.snapshots.length} immutable vendor snapshots.`);
