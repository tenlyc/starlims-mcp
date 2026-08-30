import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeJson } from './vendor-lib.mjs';

const root = resolve('vendor');
const snapshots = [];
for (const source of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  for (const commit of (await readdir(resolve(root, source.name), { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${source.name}/${commit.name}`;
    const metadata = JSON.parse(await readFile(resolve(root, path, 'SNAPSHOT.json'), 'utf8'));
    snapshots.push({
      id: metadata.id,
      sourceRepository: metadata.sourceRepository,
      sourceCommit: metadata.sourceCommit,
      path,
      license: metadata.license,
      fileCount: metadata.fileCount,
      totalBytes: metadata.totalBytes,
      filesManifestSha256: metadata.filesManifestSha256
    });
  }
}
await writeJson(resolve(root, 'index.json'), { schemaVersion: 1, generatedAt: new Date().toISOString(), snapshots });
console.log(`Indexed ${snapshots.length} vendor snapshots.`);
