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
