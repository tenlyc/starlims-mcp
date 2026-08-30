import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildFileManifest, writeJson } from './vendor-lib.mjs';

const profiles = {
  starlimsvscode: {
    repository: 'MrDoe/starlimsvscode',
    license: 'MIT',
    paths: [
      'LICENSE.md',
      'src/backend/SCM_API',
      'src/backend/SCM_API.sdp',
      'src/services',
      'src/providers',
      'src/test',
      'src/extension.ts'
    ],
    notes: [
      'The upstream package.json is intentionally not mirrored because the reviewed commit contains an abnormally large, corrupted metadata blob.',
      'The snapshot preserves the MCP implementation, its local service/provider dependencies, tests, and the complete SCM_API source and SDP artifact.'
    ]
  },
  'starlims-devtools': {
    repository: 'tenlyc/starlims-devtools',
    license: 'MIT',
    paths: [
      'LICENSE',
      'package.json',
      'components/shared-components.lock.json',
      'docs/MCP_ARCHITECTURE.md',
      'electron/mcpServer.ts',
      'electron/externalMcpManager.ts',
      'electron/genericAgentRuntime.ts',
      'src/components/MCP',
      'src/services/agentPermissions.ts',
      'src/services/enterpriseService.ts',
      'src/services/formResources.ts',
      'src/services/mcpApprovalStore.ts',
      'src/services/writeGateService.ts',
      'src/scm_api',
      'scripts/mcp-smoke-test.ts',
      'scripts/form-resources-mcp-smoke-test.ts',
      'scripts/generic-agent-tools-smoke-test.ts',
      'scripts/shared-mcp-component-smoke-test.ts'
    ],
    notes: [
      'This is an implementation snapshot, not a runtime dependency.',
      'The complete historical DevTools SCM tree is retained for recovery and provenance. Current owned extensions are cataloged under the single merged SCM_API deployment model.'
    ]
  }
};

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const profileName = valueAfter('--profile');
const source = valueAfter('--source');
const expectedCommit = valueAfter('--commit');
const replace = args.includes('--replace');
const profile = profiles[profileName];

if (!profile || !source || !expectedCommit || !/^[0-9a-f]{40}$/.test(expectedCommit)) {
  throw new Error('Usage: node scripts/import-vendor-snapshot.mjs --profile <starlimsvscode|starlims-devtools> --source <git-directory> --commit <40-char-commit> [--replace]');
}

const sourceRoot = resolve(source);
const git = (...gitArgs) => spawnSync('git', ['-C', sourceRoot, ...gitArgs], { encoding: 'utf8' });
const actualCommit = git('rev-parse', 'HEAD');
if (actualCommit.status !== 0 || actualCommit.stdout.trim() !== expectedCommit) {
  throw new Error(`Source HEAD does not match ${expectedCommit}.`);
}
const status = git('status', '--porcelain');
if (status.status !== 0 || status.stdout.trim()) throw new Error('Source repository must be clean before creating a snapshot.');

const destination = resolve('vendor', profileName, expectedCommit);
try {
  await stat(destination);
  if (!replace) throw new Error(`Snapshot already exists: ${destination}`);
  await rm(destination, { recursive: true, force: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

for (const path of profile.paths) {
  const from = resolve(sourceRoot, path);
  const to = resolve(destination, path);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, preserveTimestamps: true });
}

const fileManifest = await buildFileManifest(destination);
await writeFile(resolve(destination, 'FILES.sha256'), fileManifest.content, 'utf8');
await writeJson(resolve(destination, 'SNAPSHOT.json'), {
  schemaVersion: 1,
  id: profileName,
  sourceRepository: profile.repository,
  sourceUrl: `https://github.com/${profile.repository}`,
  sourceCommit: expectedCommit,
  license: profile.license,
  capturedAt: new Date().toISOString(),
  immutable: true,
  includedPaths: profile.paths,
  fileCount: fileManifest.files,
  totalBytes: fileManifest.bytes,
  filesManifestSha256: fileManifest.digest,
  notes: profile.notes
});

console.log(`Imported ${profileName} ${expectedCommit.slice(0, 12)} (${fileManifest.files} files, ${fileManifest.bytes} bytes).`);
