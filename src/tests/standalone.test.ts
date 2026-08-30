import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StarlimsHttpAdapter } from '../adapters/starlims-http-adapter.js';
import { loadStarlimsMcpConfig } from '../config.js';
import { contentVersion, parseFormResources, setFormResourceValue } from '../form-resources.js';
import { redactLogValue, type StarlimsLogger } from '../logger.js';
import { createStarlimsMcpServer } from '../server.js';
import { startHttpTransport } from '../transports.js';

const logger: StarlimsLogger = { debug: () => undefined, info: () => undefined, error: () => undefined };
const resourcesUri = '/Applications/Equipment/EQUIPMENT_MANAGER/HTMLForms/Resources/Equipment_Ledger';
const codeUri = '/ServerScripts/TOOLS/Hello';
const initialResources = '<?xml version="1.0"?><NewDataSet><ResourcesTable><Guid>g-1</Guid><ResourceId>TITLE</ResourceId><ResourceValue>Equipment</ResourceValue></ResourcesTable></NewDataSet>';

async function body(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function json(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

async function startMockScmApi(): Promise<{ baseUrl: string; close(): Promise<void>; codes: Map<string, string>; requests: string[] }> {
  const codes = new Map<string, string>([[`${codeUri}|ENG`, 'return "hello";'], [`${resourcesUri}|CHS`, initialResources]]);
  const requests: string[] = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const endpoint = url.pathname.match(/SCM_API\.([^.]+)\.lims$/)?.[1] || '';
    requests.push(endpoint);
    if (request.headers.starlimsuser !== 'developer' || request.headers.starlimspass !== 'secret-pass') {
      json(response, { success: false, error: 'bad credentials' }, 401);
      return;
    }
    if (endpoint === 'GetSessions') return json(response, { success: true, data: { starlimssessionid: 's1', langid: 'ENG' } });
    if (endpoint === 'Version') return json(response, { success: true, data: '1.8.2' });
    if (endpoint === 'GetEnterpriseItems') return json(response, { success: true, data: { items: [{ name: 'Hello', uri: codeUri, type: 'SS' }] } });
    if (endpoint === 'Search') return json(response, { success: true, data: { items: [{ name: url.searchParams.get('itemName'), uri: codeUri }] } });
    if (endpoint === 'GlobalSearch') return json(response, { success: true, data: { items: [{ name: 'Hello', uri: codeUri }], totalCount: 1 } });
    if (endpoint === 'GetLanguages') return json(response, { success: true, data: [['ENG', 'English'], ['CHS', 'Chinese']] });
    if (endpoint === 'TableGetById') return json(response, { success: true, data: '<Table><Name>BATCHES</Name></Table>' });
    if (endpoint === 'GetCode') {
      const uri = url.searchParams.get('URI') || '';
      const language = url.searchParams.get('UserLang') || 'ENG';
      return json(response, { success: true, data: { code: codes.get(`${uri}|${language}`) || '', language } });
    }
    if (endpoint === 'SaveCode') {
      const data = JSON.parse(await body(request)) as { URI: string; UserLang: string; Code: string };
      codes.set(`${data.URI}|${data.UserLang}`, data.Code);
      return json(response, { success: true, data: true });
    }
    if (endpoint === 'CheckOut' || endpoint === 'CheckIn') return json(response, { success: true, data: true });
    json(response, { success: false, error: `unknown endpoint ${endpoint}` }, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock SCM_API did not start.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    codes,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

test('configuration loads from environment and logs redact credentials', async () => {
  const config = await loadStarlimsMcpConfig([], {
    STARLIMS_BASE_URL: 'https://example.test/', STARLIMS_USER: 'user', STARLIMS_PASSWORD: 'top-secret'
  });
  assert.equal(config.baseUrl, 'https://example.test');
  assert.equal(config.permissionPolicy, 'read-only');
  assert.equal(config.transport, 'stdio');
  const redacted = redactLogValue({ password: 'top-secret', authorization: 'Bearer abc', url: 'https://example.test?token=abc' }, ['top-secret']);
  assert.ok(!redacted.includes('top-secret'));
  assert.ok(!redacted.includes('Bearer abc'));
});

test('form resources preserve unrelated values when one resource changes', () => {
  const updated = setFormResourceValue(initialResources, 'TITLE', '设备 & 台账');
  assert.equal(updated.created, false);
  assert.deepEqual(parseFormResources(updated.xml).resources, [{ resourceId: 'TITLE', resourceValue: '设备 & 台账', guid: 'g-1' }]);
});

test('standalone adapter reads, searches and retrieves multilingual resources from a mock SCM_API', async (context) => {
  const mock = await startMockScmApi();
  context.after(() => mock.close());
  const adapter = new StarlimsHttpAdapter({
    baseUrl: mock.baseUrl, user: 'developer', password: 'secret-pass', urlSuffix: 'lims', language: 'ENG',
    permissionPolicy: 'read-only', profile: 'unified', transport: 'stdio', host: '127.0.0.1', port: 3102
  }, logger);
  await adapter.connect();
  assert.ok(adapter.capabilities.includes('code.read'));
  assert.ok(!adapter.capabilities.includes('code.write'));
  const browse = await adapter.invoke('browse_tree', {}) as { totalItems: number };
  const search = await adapter.invoke('search_by_name', { query: 'Hello' }) as { totalItems: number };
  const table = await adapter.invoke('get_table_definition', { uri: '/Tables/BATCHES' }) as { definition: string };
  const resources = await adapter.invoke('get_form_resources', { uri: resourcesUri, language: 'CHS', includeXml: true }) as { resources: unknown[]; version: string };
  assert.equal(browse.totalItems, 1);
  assert.equal(search.totalItems, 1);
  assert.match(table.definition, /BATCHES/);
  assert.equal(resources.resources.length, 1);
  assert.equal(resources.version, contentVersion(initialResources));
  await assert.rejects(() => adapter.invoke('save_item', { uri: codeUri, code: 'changed' }), /read-only/);
});

test('write policy enforces versions and verifies save, checkout, resources and check-in against a mock SCM_API', async (context) => {
  const mock = await startMockScmApi();
  context.after(() => mock.close());
  const adapter = new StarlimsHttpAdapter({
    baseUrl: mock.baseUrl, user: 'developer', password: 'secret-pass', urlSuffix: 'lims', language: 'ENG',
    permissionPolicy: 'allow-writes', profile: 'unified', transport: 'stdio', host: '127.0.0.1', port: 3102
  }, logger);
  await adapter.connect();
  const read = await adapter.invoke('get_item_code', { uri: codeUri, language: 'ENG' }) as { version: string };
  const checkout = await adapter.invoke('checkout_item', { uri: codeUri, language: 'ENG' }) as { checkedOut: boolean };
  const saved = await adapter.invoke('save_item', { uri: codeUri, language: 'ENG', code: 'return "changed";', expectedVersion: read.version }) as { saved: boolean; version: string };
  assert.equal(checkout.checkedOut, true);
  assert.equal(saved.saved, true);
  assert.equal(mock.codes.get(`${codeUri}|ENG`), 'return "changed";');
  await assert.rejects(() => adapter.invoke('save_item', { uri: codeUri, language: 'ENG', code: 'stale', expectedVersion: read.version }), /changed after it was read/);

  const resourceRead = await adapter.invoke('get_form_resources', { uri: resourcesUri, language: 'CHS' }) as { version: string };
  await adapter.invoke('set_form_resource', { uri: resourcesUri, language: 'CHS', resourceId: 'TITLE', resourceValue: '设备台账', expectedVersion: resourceRead.version });
  assert.equal(parseFormResources(mock.codes.get(`${resourcesUri}|CHS`) || '').resources[0]?.resourceValue, '设备台账');
  const checkedIn = await adapter.invoke('checkin_item', { uri: codeUri, language: 'ENG', reason: 'integration test' }) as { checkedIn: boolean };
  assert.equal(checkedIn.checkedIn, true);
  assert.ok(mock.requests.includes('SaveCode'));
});

test('CLI exposes the standalone read-only server over stdio', async (context) => {
  const mock = await startMockScmApi();
  context.after(() => mock.close());
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../cli.js', import.meta.url))],
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      STARLIMS_BASE_URL: mock.baseUrl,
      STARLIMS_USER: 'developer',
      STARLIMS_PASSWORD: 'secret-pass',
      STARLIMS_MCP_PERMISSION_POLICY: 'read-only'
    },
    stderr: 'pipe'
  });
  const client = new Client({ name: 'standalone-test', version: '1.0.0' });
  context.after(async () => { await client.close(); });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === 'get_item_code'));
  assert.ok(!tools.tools.some((tool) => tool.name === 'save_item'));
  const result = await client.callTool({ name: 'get_item_code', arguments: { uri: codeUri, language: 'ENG' } });
  assert.equal(result.isError, undefined);
  assert.match(JSON.stringify(result.structuredContent), /hello/);
});

test('streamable HTTP transport serves the same shared MCP runtime with bearer protection', async (context) => {
  const mock = await startMockScmApi();
  context.after(() => mock.close());
  const adapter = new StarlimsHttpAdapter({
    baseUrl: mock.baseUrl, user: 'developer', password: 'secret-pass', urlSuffix: 'lims', language: 'ENG',
    permissionPolicy: 'read-only', profile: 'unified', transport: 'http', host: '127.0.0.1', port: 3102, authToken: '0123456789abcdef'
  }, logger);
  await adapter.connect();
  const server = await startHttpTransport({
    host: '127.0.0.1', port: 0, authToken: '0123456789abcdef', logger,
    createServer: () => createStarlimsMcpServer({ version: '0.4.0', profile: 'unified', adapter })
  });
  context.after(() => server.close());
  const client = new Client({ name: 'http-test', version: '1.0.0' });
  context.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { authorization: 'Bearer 0123456789abcdef' } } }));
  const capabilities = await client.callTool({ name: 'get_capabilities', arguments: {} });
  assert.match(JSON.stringify(capabilities.structuredContent), /starlims-http/);
});
