import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('browser entry bundles shared schemas without Node or server dependencies', async () => {
  const result = await build({
    entryPoints: ['src/browser.ts'], bundle: true, platform: 'browser', format: 'esm',
    write: false, metafile: true,
  });
  assert.ok(result.outputFiles[0].text.includes('mcpReadCacheKey'));
  assert.ok(!Object.keys(result.metafile!.inputs).some(path => /express|http-adapter|src\/server\.ts/.test(path)));
});

test('shared server client bundles for Electron renderer without Node, Buffer or MCP server runtime', async () => {
  const result = await build({ entryPoints: ['src/client.ts'], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true });
  assert.ok(result.outputFiles[0].text.includes('StarlimsHttpAdapter'));
  assert.ok(!Object.keys(result.metafile!.inputs).some(path => /express|src\/server\.ts|src\/config\.ts|node:/.test(path)));
});
