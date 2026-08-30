import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const outputDirectory = new URL('../release-assets/', import.meta.url);
const outputFile = new URL('starlims-mcp-devtools-server.cjs', outputDirectory);
await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [new URL('../src/devtools-server.ts', import.meta.url).pathname],
  outfile: outputFile.pathname,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  minify: true,
  define: { __STARLIMS_MCP_VERSION__: JSON.stringify(packageJson.version) },
  banner: { js: '#!/usr/bin/env node' }
});
const content = await readFile(outputFile);
const digest = createHash('sha256').update(content).digest('hex');
await writeFile(new URL('starlims-mcp-devtools-server.cjs.sha256', outputDirectory), `${digest}  starlims-mcp-devtools-server.cjs\n`);
console.log(`Built DevTools Server ${packageJson.version} (${digest}).`);
