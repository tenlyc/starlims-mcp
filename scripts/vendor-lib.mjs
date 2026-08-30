import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export const normalizePath = (value) => value.split('\\').join('/');

export async function listFiles(root) {
  const files = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  await walk(resolve(root));
  return files;
}

function canonicalFileContent(content) {
  if (content.includes(0)) return content;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    return Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8');
  } catch {
    return content;
  }
}

export async function sha256(path) {
  return createHash('sha256').update(canonicalFileContent(await readFile(path))).digest('hex');
}

export async function buildFileManifest(snapshotRoot) {
  const excluded = new Set(['FILES.sha256', 'SNAPSHOT.json']);
  const files = (await listFiles(snapshotRoot)).filter((path) => !excluded.has(normalizePath(relative(snapshotRoot, path))));
  const lines = [];
  let bytes = 0;
  for (const file of files) {
    const path = normalizePath(relative(snapshotRoot, file));
    const content = canonicalFileContent(await readFile(file));
    lines.push(`${createHash('sha256').update(content).digest('hex')}  ${path}`);
    bytes += content.byteLength;
  }
  const content = `${lines.join('\n')}\n`;
  return {
    content,
    files: files.length,
    bytes,
    digest: createHash('sha256').update(content).digest('hex')
  };
}

export async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
