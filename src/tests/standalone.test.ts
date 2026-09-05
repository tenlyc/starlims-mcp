import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StarlimsHttpAdapter } from '../adapters/starlims-http-adapter.js';
import { loadStarlimsMcpConfig } from '../config.js';
import { contentVersion, parseFormResources, setFormResourceValue, toProgrammaticFormResources } from '../form-resources.js';
import { redactLogValue, type StarlimsLogger } from '../logger.js';
import { createStarlimsMcpServer } from '../server.js';
import { getProfileTools } from '../catalog.js';
import { startHttpTransport } from '../transports.js';
import { ensureFormResourceBinding, inspectFormResourceBinding } from '../form-resource-binding.js';

const logger: StarlimsLogger = { debug: () => undefined, info: () => undefined, error: () => undefined };
const resourcesUri = '/Applications/Equipment/EQUIPMENT_MANAGER/HTMLForms/Resources/Equipment_Ledger';
const codeUri = '/ServerScripts/TOOLS/Hello';

test('shared server alone registers all 37 DevTools tools and preserves screenshot results', async context => {
  const contracts = getProfileTools('devtools');
  const calls: string[] = [];
  const server = await startHttpTransport({ host: '127.0.0.1', port: 0, logger,
    createServer: () => createStarlimsMcpServer({ version: '0.5.2', profile: 'devtools', adapter: {
      id: 'host-adapter', capabilities: [...new Set(contracts.map(tool => tool.capability))],
      invoke: async tool => { calls.push(tool); return tool === 'capture_form_screenshot' ? { imageData: 'aGVsbG8=', mimeType: 'image/png', path: '/tmp/test.png' } : { invoked: tool }; }
    } }) });
  context.after(() => server.close());
  const client = new Client({ name: 'catalog-integration-test', version: '1' });
  context.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url)));
  const listed = (await client.listTools()).tools.map(tool => tool.name);
  assert.equal(listed.length, 37); assert.equal(new Set(listed).size, 37);
  assert.deepEqual(new Set(listed), new Set(['get_capabilities', ...contracts.map(tool => tool.id)]));
  const capability = (await client.callTool({name:'get_capabilities', arguments:{}})).structuredContent as { tools: {id: string}[] };
  assert.deepEqual(new Set(capability.tools.map(tool => tool.id)), new Set(contracts.map(tool => tool.id)));
  const screenshot = await client.callTool({ name: 'capture_form_screenshot', arguments: {} });
  assert.equal((screenshot.content as {type: string}[])[0].type, 'image');
  assert.equal('imageData' in (screenshot.structuredContent as Record<string, unknown>), false);
  await client.callTool({name:'get_menu_configuration', arguments:{group:'Demo'}});
  assert.deepEqual(calls, ['capture_form_screenshot', 'get_menu_configuration']);
});
const initialResources = '<?xml version="1.0"?><NewDataSet><ResourcesTable><Guid>g-1</Guid><ResourceId>TITLE</ResourceId><ResourceValue>Equipment</ResourceValue></ResourcesTable></NewDataSet>';
const formUri = resourcesUri.replace('/Resources/', '/XML/');
const formGuid = '11111111-2222-4333-8444-555555555555';
const initialForm = '<Form xmlns="http://www.starlims.com/html"><Guid>aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee</Guid><Text>Fixture</Text></Form>';

async function body(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function json(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

async function startMockScmApi(options: { checkinMode?: 'error-string' | 'retain' | 'invalid-status'; checkoutLanguage?: string; beforeReadCode?: (uri: string, count: number, codes: Map<string, string>) => void } = {}): Promise<{ baseUrl: string; close(): Promise<void>; codes: Map<string, string>; requests: string[] }> {
  const codes = new Map<string, string>([[`${codeUri}|ENG`, 'return "hello";'], [`${resourcesUri}|CHS`, initialResources], [`${formUri}|CHS`, initialForm]]);
  const pending = new Set([formGuid, 'code-guid']);
  let checkinCalled = false;
  const reads = new Map<string, number>();
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
    if (endpoint === 'Search') return json(response, { success: true, data: { items: url.searchParams.get('itemName') === 'Equipment_Ledger' ? [{ name: 'Equipment_Ledger', uri: formUri, guid: formGuid }] : [{ name: 'Hello', uri: codeUri, guid: 'code-guid' }] } });
    if (endpoint === 'GlobalSearch') return json(response, { success: true, data: { items: [{ name: 'Hello', uri: codeUri, guid: 'code-guid' }], totalCount: 1 } });
    if (endpoint === 'GetCheckedOutItems') return json(response, { success: true, data: options.checkinMode === 'invalid-status' && checkinCalled ? 'invalid' : `<DataSet>${[...pending].map((id) => `<PendingCheckins><CHILDID>${id}</CHILDID><LANGID>${options.checkoutLanguage || 'CHS'}</LANGID></PendingCheckins>`).join('')}</DataSet>` });
    if (endpoint === 'GetLanguages') return json(response, { success: true, data: [['ENG', 'English'], ['CHS', 'Chinese']] });
    if (endpoint === 'TableGetById') return json(response, { success: true, data: '<Table><Name>BATCHES</Name></Table>' });
    if (endpoint === 'GetCode') {
      const uri = url.searchParams.get('URI') || '';
      const language = url.searchParams.get('UserLang') || 'ENG';
      reads.set(uri, (reads.get(uri) || 0) + 1);
      options.beforeReadCode?.(uri, reads.get(uri)!, codes);
      return json(response, { success: true, data: { code: codes.get(`${uri}|${language}`) || '', language } });
    }
    if (endpoint === 'SaveCode') {
      const data = JSON.parse(await body(request)) as { URI: string; UserLang: string; Code: string };
      codes.set(`${data.URI}|${data.UserLang}`, data.Code);
      return json(response, { success: true, data: true });
    }
    if (endpoint === 'CheckIn') {
      checkinCalled = true;
      requests.push(`CheckIn:${url.searchParams.get('URI')}`);
      if (options.checkinMode === 'error-string') return json(response, { success: true, data: 'ERROR: wrong user' });
      if (options.checkinMode !== 'retain') pending.delete(url.searchParams.get('URI') === codeUri ? 'code-guid' : formGuid);
      return json(response, { success: true, data: 'OK' });
    }
    if (endpoint === 'CheckOut') return json(response, { success: true, data: true });
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

test('designer-paste resources are converted to the SCM_API programmatic dataset format', () => {
  const designerXml = '<?xml version="1.0" encoding="utf-16"?><Resources><Resource><Id>TITLE</Id><Value>设备 &amp; 台账</Value></Resource><Resource><Id>QUERY</Id><Value>查询</Value></Resource></Resources>';
  const parsed = parseFormResources(designerXml);
  assert.equal(parsed.format, 'designer');
  assert.deepEqual(parsed.resources.map(({ resourceId, resourceValue }) => ({ resourceId, resourceValue })), [
    { resourceId: 'TITLE', resourceValue: '设备 & 台账' },
    { resourceId: 'QUERY', resourceValue: '查询' }
  ]);
  const programmatic = toProgrammaticFormResources(designerXml);
  assert.match(programmatic, /^<ResourcesDataset xmlns="http:\/\/tempuri\.org\/ResourcesDataset\.xsd">/);
  assert.equal(parseFormResources(programmatic).format, 'programmatic');
  assert.equal(parseFormResources(programmatic).resources.length, 2);
  assert.doesNotMatch(programmatic, /<Resource>/);
});

test('designer-paste imports preserve server-only resources and existing GUIDs', () => {
  const designer = '<Resources><Resource><Id>TITLE</Id><Value>设备台账</Value></Resource></Resources>';
  const current = '<ResourcesDataset xmlns="http://tempuri.org/ResourcesDataset.xsd"><ResourcesTable><Guid>g-title</Guid><ResourceId>TITLE</ResourceId><ResourceValue>Equipment</ResourceValue></ResourcesTable><ResourcesTable><Guid>g-guide</Guid><ResourceId>GUIDE</ResourceId><ResourceValue>[]</ResourceValue></ResourcesTable></ResourcesDataset>';
  const merged = parseFormResources(toProgrammaticFormResources(designer, current));
  assert.deepEqual(merged.resources, [
    { resourceId: 'TITLE', resourceValue: '设备台账', guid: 'g-title' },
    { resourceId: 'GUIDE', resourceValue: '[]', guid: 'g-guide' }
  ]);
});

test('resource XML handles CDATA, namespace prefixes, self-closing values and empty datasets', () => {
  const designer = '<Resources><Resource><Id>TITLE</Id><Value><![CDATA[A & B <tag>]]> &amp; C</Value></Resource></Resources>';
  assert.equal(parseFormResources(toProgrammaticFormResources(designer)).resources[0].resourceValue, 'A & B <tag> & C');
  const namespaced = '<r:ResourcesDataset xmlns:r="urn:test"><r:ResourcesTable><r:Guid>g1</r:Guid><r:ResourceId>TITLE</r:ResourceId><r:ResourceValue/></r:ResourcesTable></r:ResourcesDataset>';
  const updated = setFormResourceValue(namespaced, 'TITLE', '你好 & world');
  assert.equal(parseFormResources(updated.xml).resources[0].resourceValue, '你好 & world');
  assert.equal(parseFormResources(updated.xml).resources[0].guid, 'g1');
  assert.equal(parseFormResources(setFormResourceValue('<Dataset />', 'TITLE', 'new').xml).resources.length, 1);
  assert.throws(() => parseFormResources('<Resources><Resource><Id>A</Id><Value>&bogus;</Value></Resource></Resources>'));
});

test('HTML resources binding uses the authoritative GUID and preserves layered fallback', () => {
  const bound = ensureFormResourceBinding(initialForm, formGuid, 'CHS');
  assert.equal(bound.changed, true);
  assert.match(bound.xml, new RegExp(`formID=${formGuid}&amp;languageID=CHS&amp;isProgramatic=Y`));
  assert.equal(ensureFormResourceBinding(bound.xml, formGuid, 'CHS').changed, false);
  const fallback = bound.xml.replace('</Resources>', '<AlternativeData>base-layer-source</AlternativeData></Resources>');
  const switched = ensureFormResourceBinding(fallback, formGuid, 'ENG');
  assert.match(switched.xml, /languageID=ENG/);
  assert.match(switched.xml, /<AlternativeData>base-layer-source<\/AlternativeData>/);
  assert.throws(() => ensureFormResourceBinding('<Form><Resources><Data>Custom.GetResources.lims</Data></Resources></Form>', formGuid, 'CHS'), /custom Resources/);
});

test('designer merge blocks a concurrent resource update without a caller version', async (context) => {
  const concurrent = initialResources.replace('Equipment', 'concurrent update');
  const mock = await startMockScmApi({ beforeReadCode: (uri, count, codes) => {
    if (uri === resourcesUri && count === 2) codes.set(`${uri}|CHS`, concurrent);
  } });
  context.after(() => mock.close());
  const adapter = new StarlimsHttpAdapter({ baseUrl: mock.baseUrl, user: 'developer', password: 'secret-pass', urlSuffix: 'lims',
    language: 'CHS', permissionPolicy: 'allow-writes', profile: 'unified', transport: 'stdio', host: '127.0.0.1', port: 3102 }, logger);
  await assert.rejects(() => adapter.invoke('save_form_resources', { uri: resourcesUri, language: 'CHS',
    resourceXml: '<Resources><Resource><Id>NEW</Id><Value>new</Value></Resource></Resources>' }), /content-version gate/);
  assert.equal(mock.codes.get(`${resourcesUri}|CHS`), concurrent);
  assert.ok(!mock.requests.includes('SaveCode'));
});

test('resource parsing rejects unsupported or malformed documents instead of verifying zero parsed rows', () => {
  assert.throws(() => parseFormResources('<SomethingElse />'), /Unsupported Form Resources root/);
  assert.throws(() => parseFormResources('<Resources><Resource><Value>missing id</Value></Resource></Resources>'), /without a valid ID/);
  assert.throws(() => parseFormResources('<Resources><Resource><Id>OK</Id><Value>valid</Value></Resource><Resource><Value>missing id</Value></Resource></Resources>'), /without a valid ID/);
  assert.throws(() => parseFormResources('<Resources><Resource><Id>A</Id><Value>1</Value></Resource><Resource><Id>A</Id><Value>2</Value></Resource></Resources>'), /duplicate ResourceId/);
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
  const resources = await adapter.invoke('get_form_resources', { uri: resourcesUri, language: 'CHS', includeXml: true }) as { resources: unknown[]; version: string; formDiagnostics: { status: string }; runtimeVerified: boolean };
  assert.equal(resources.formDiagnostics.status, 'repair_required');
  assert.equal(resources.runtimeVerified, false);
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
  const family = await adapter.invoke('checkout_item', { uri: resourcesUri, language: 'CHS' }) as { alreadyCheckedOut: boolean; checkoutLanguage: string };
  assert.equal(family.alreadyCheckedOut, true);
  assert.equal(family.checkoutLanguage, 'CHS');
  await assert.rejects(() => adapter.invoke('checkout_item', { uri: resourcesUri, language: 'ENG' }), /no checkout was performed/);
  const checkout = await adapter.invoke('checkout_item', { uri: codeUri, language: 'ENG' }) as { checkedOut: boolean };
  const saved = await adapter.invoke('save_item', { uri: codeUri, language: 'ENG', code: 'return "changed";', expectedVersion: read.version }) as { saved: boolean; version: string };
  assert.equal(checkout.checkedOut, true);
  assert.equal(saved.saved, true);
  assert.equal(mock.codes.get(`${codeUri}|ENG`), 'return "changed";');
  await assert.rejects(() => adapter.invoke('save_item', { uri: codeUri, language: 'ENG', code: 'stale', expectedVersion: read.version }), /changed after it was read/);

  const resourceRead = await adapter.invoke('get_form_resources', { uri: resourcesUri, language: 'CHS' }) as { version: string };
  const resourceSaved = await adapter.invoke('set_form_resource', { uri: resourcesUri, language: 'CHS', resourceId: 'TITLE', resourceValue: '设备台账', expectedVersion: resourceRead.version }) as {
    workingCopyUpdated: boolean;
    designerReloadRequired: boolean;
    runtimeSyncRequiresCheckIn: boolean;
    nextStep: string;
  };
  assert.equal(parseFormResources(mock.codes.get(`${resourcesUri}|CHS`) || '').resources[0]?.resourceValue, '设备台账');
  assert.equal(resourceSaved.workingCopyUpdated, true);
  assert.equal(resourceSaved.designerReloadRequired, true);
  assert.equal(resourceSaved.runtimeSyncRequiresCheckIn, true);
  assert.match(resourceSaved.nextStep, /Close and reopen/);
  assert.equal(ensureFormResourceBinding(mock.codes.get(`${formUri}|CHS`)!, formGuid, 'CHS').changed, false);
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
    permissionPolicy: 'allow-writes', profile: 'unified', transport: 'http', host: '127.0.0.1', port: 3102, authToken: '0123456789abcdef'
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
  const initial = await client.callTool({ name: 'get_item_code', arguments: { uri: codeUri, language: 'ENG' } });
  const version = (initial.structuredContent as { version?: string }).version;
  const largeCode = `/* large STARLIMS script */\n${'x'.repeat(256 * 1024)}`;
  const saved = await client.callTool({ name: 'save_item', arguments: { uri: codeUri, language: 'ENG', code: largeCode, expectedVersion: version } });
  assert.equal(saved.isError, undefined);
  assert.equal(mock.codes.get(`${codeUri}|ENG`), largeCode);
});

test('resources distinguish data from loading bindings and diagnose Designer column types', () => {

assert.throws(() => parseFormResources('<Resources><Data>RUNTIME_SUPPORT.GetFormResources.lims</Data><KeyItem>ResourceId</KeyItem></Resources>'), /Expected resource data rows/);
assert.throws(() => parseFormResources('<ResourcesDataset><ResourcesTable><ResourceId>TITLE</ResourceId></ResourcesTable></ResourcesDataset>'), /include a value/);
assert.equal(parseFormResources('<ResourcesDataset/>').resources.length, 0);
assert.equal(parseFormResources('<Resources><Resource><Id>TITLE</Id><Value/></Resource></Resources>').resources[0].resourceValue, '');
const diagnosticGuid = '11111111-2222-4333-8444-555555555555';
const malformedColumns = '<Form><Guid>aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee</Guid><__array__Columns><item><Id>OrgName</Id></item></__array__Columns></Form>';
const diagnosis = inspectFormResourceBinding(malformedColumns, diagnosticGuid, 'ENG');
assert.equal(diagnosis.status, 'repair_required');
assert.deepEqual(diagnosis.missingColumnTypes, ['OrgName']);
assert.equal(diagnosis.runtimeVerified, false);
assert.equal(diagnosis.warnings.length, 2);
const correctColumns = ensureFormResourceBinding(malformedColumns.replace('<Id>OrgName</Id>', '<xtype>StarlimsTreeListColumn</xtype><Id>OrgName</Id>'), diagnosticGuid, 'ENG').xml;
assert.equal(inspectFormResourceBinding(correctColumns, diagnosticGuid, 'ENG').status, 'valid');
assert.deepEqual(inspectFormResourceBinding(correctColumns, diagnosticGuid, 'ENG').missingColumnTypes, []);
assert.equal(inspectFormResourceBinding('<Form><Resources><Data>Custom.Read.lims</Data></Resources></Form>', diagnosticGuid, 'ENG').status, 'unsupported');

});

test('resource writes reject a mismatched checkout language before SaveCode', async () => {
  const mock = await startMockScmApi({ checkoutLanguage: 'ENG' });
  try {
    const config = await loadStarlimsMcpConfig([], { STARLIMS_BASE_URL: mock.baseUrl, STARLIMS_USER: 'developer', STARLIMS_PASSWORD: 'secret-pass', STARLIMS_MCP_PERMISSION_POLICY: 'allow-writes' });
    const adapter = new StarlimsHttpAdapter(config, logger);
    const read = await adapter.invoke('get_form_resources', { uri: resourcesUri, language: 'CHS' }) as { formDiagnostics: { checkoutLanguage: string; writableInRequestedLanguage: boolean } };
    assert.equal(read.formDiagnostics.checkoutLanguage, 'ENG');
    assert.equal(read.formDiagnostics.writableInRequestedLanguage, false);
    for (const [tool, args] of [
      ['save_form_resources', { resourceXml: initialResources }],
      ['set_form_resource', { resourceId: 'TITLE', resourceValue: '中文' }]
    ] as const) {
      await assert.rejects(adapter.invoke(tool, { uri: resourcesUri, language: 'CHS', ...args }), /checkout language ENG/);
    }
    assert.ok(!mock.requests.includes('SaveCode'));
  } finally { await mock.close(); }
});

for (const mode of ['error-string', 'retain', 'invalid-status'] as const) {
  test(`checkin rejects ${mode} instead of reporting false success`, async () => {
    const mock = await startMockScmApi({ checkinMode: mode });
    try {
      const config = await loadStarlimsMcpConfig([], { STARLIMS_BASE_URL: mock.baseUrl, STARLIMS_USER: 'developer', STARLIMS_PASSWORD: 'secret-pass', STARLIMS_MCP_PERMISSION_POLICY: 'allow-writes' });
      const adapter = new StarlimsHttpAdapter(config, logger);
      await assert.rejects(adapter.invoke('checkin_item', { uri: resourcesUri, language: 'CHS', reason: 'test' }), /rejected check-in|still checked out|Invalid checkout status/);
      assert.ok(mock.requests.includes(`CheckIn:${formUri}`), 'Resources must target its parent Form XML.');
    } finally { await mock.close(); }
  });
}
test('checkin verifies parent form checkout release for a Resources URI', async () => {
  const mock = await startMockScmApi();
  try {
    const config = await loadStarlimsMcpConfig([], { STARLIMS_BASE_URL: mock.baseUrl, STARLIMS_USER: 'developer', STARLIMS_PASSWORD: 'secret-pass', STARLIMS_MCP_PERMISSION_POLICY: 'allow-writes' });
    const adapter = new StarlimsHttpAdapter(config, logger);
    const result = await adapter.invoke('checkin_item', { uri: resourcesUri, language: 'CHS', reason: 'test' }) as { verified: boolean; targetUri: string };
    assert.equal(result.verified, true);
    assert.equal(result.targetUri, formUri);
  } finally { await mock.close(); }
});
