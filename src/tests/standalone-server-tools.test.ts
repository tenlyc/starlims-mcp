import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StarlimsHttpAdapter } from '../adapters/starlims-http-adapter.js';
import { getProfileTools } from '../catalog.js';
import { createStarlimsMcpServer } from '../server.js';
import { startHttpTransport } from '../transports.js';
import { tableDefinitionVersion, prepareTableCaptionXml, waitForTableReadBack } from '../table-definition.js';
import type { StarlimsMcpConfig } from '../config.js';

const logger = { debug() {}, info() {}, error() {} };
const tableUri = '/Tables/Database/TEST';
const scriptUri = '/ServerScripts/TOOLS/Hello';
const formId = '11111111-2222-4333-8444-555555555555';
const formUri = '/Applications/Demo/Manager/HTMLForms/XML/Entry';
const menuInput = { group: 'Demo', itemName: 'Entry', formUri, captions: { CHS: '测试' }, roles: ['Lab_Admin'] };
const definition = '<TableDTO><Id>table-id</Id><Name>TEST</Name><__array__Fields><item><Id>f1</Id><Name>VALUE</Name><Type>CHAR</Type><Length>10</Length><SCaptions>VALUE,CHS,值</SCaptions></item></__array__Fields></TableDTO>';
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
type Call = { endpoint: string; url: URL; body: Record<string, any> };
function fixture(policy: 'read-only' | 'allow-writes' = 'allow-writes') {
  const calls: Call[] = [];
  const pending = new Set<string>();
  const tree: Record<string, unknown>[] = [{ NAME: 'Demo', PARENT: null }];
  const roles = [{ ROLE: 'Lab_Admin', ROLEID: 'role-id' }];
  const grants: Record<string, unknown>[] = [], captions: Record<string, unknown>[] = [];
  const state = { definition, log: 'old\r\nwarning\r\nerror\r\n', menuWrites: 0, rejectCreate: false,
    retainUndo: false, retainCheckin: false, saveNoop: false, staleOnStatus: false, failMenu: false, truncateMenus: false,
    override: undefined as ((call: Call) => Response | undefined) | undefined };
  const config: StarlimsMcpConfig = { baseUrl: 'https://example.test/LIMS', user: 'engineer', password: 'test-secret',
    urlSuffix: 'lims', language: 'CHS', permissionPolicy: policy, profile: 'unified', transport: 'stdio', host: '127.0.0.1', port: 3102 };
  const adapter = new StarlimsHttpAdapter(config, logger, (async (input, options) => {
    const url = new URL(String(input)), endpoint = url.pathname.match(/SCM_API\.(\w+)\.lims$/)?.[1] || '';
    const body = JSON.parse(String(options?.body || '{}'));
    const call = { endpoint, url, body }; calls.push(call);
    assert.equal(new Headers(options?.headers).get('STARLIMSUser'), 'engineer');
    const override = state.override?.(call); if (override) return override;
    const ok = (data: unknown) => json({ success: true, data });
    switch (endpoint) {
      case 'GetSessions': return ok({ user: 'engineer' });
      case 'Version': return ok('test');
      case 'GetCode': return ok({ code: url.searchParams.get('URI')?.startsWith('/ServerLogs/') ? state.log : `<Form><Guid>${formId}</Guid></Form>` });
      case 'GetLanguages': return ok([['CHS', 'Chinese'], ['ENG', 'English']]);
      case 'Search': return ok({ items: [{ uri: scriptUri, guid: 'script-id' }] });
      case 'GetCheckedOutItems':
        if (state.staleOnStatus) state.definition = state.definition.replace('<Length>10</Length>', '<Length>12</Length>');
        return ok(`<DataSet>${[...pending].map(id => `<PendingCheckins><CHILDID>${id}</CHILDID><CHILDNAME>A &amp; B</CHILDNAME><LANGID>CHS</LANGID></PendingCheckins>`).join('')}</DataSet>`);
      case 'CheckOut': pending.add('table-id'); return ok(null);
      case 'CheckIn': if (!state.retainCheckin) pending.delete('table-id'); return ok('OK');
      case 'UndoCheckOut': if (!state.retainUndo) pending.clear(); return ok(null);
      case 'TableGetById': return ok(state.definition);
      case 'TableAdd': return ok({ success: !state.rejectCreate, message: 'creation rejected' });
      case 'TableSave': if (!state.saveNoop) state.definition = body.TableXml; return ok('saved');
      case 'Add': return ok({ success: !state.rejectCreate, data: 'creation rejected' });
      case 'RunScript': {
        if (body.URI === '/ServerScripts/SCM_API/McpGetCheckInHistory') return ok({ success: true, items: [{ uri: scriptUri, checkedInBy: body.Parameters[0] }] });
        if (body.URI === '/ServerScripts/SCM_API/MenuManagement') {
          if (body.EntryPoint === 'ResolveForm') return ok([['app-id', formId]]);
          state.menuWrites++;
          if (state.failMenu) return ok('ERROR: rejected');
          const p = body.Parameters;
          tree.push({ PARENT: p[0], NAME: p[1], ITEMSORTER: p[7], COMMANDNAME: p[3] + '.' + p[4], PARENTID: p[5], ITEMID: p[6], COMMANDTYPE: 'A', DESTINATIONWINDOW: 'A', COMMANDPARAMETERS: p[10] });
          for (const [lang, caption] of p[8]) captions.push({ LANGID: lang, CAPTION: caption });
          for (const role of p[9]) grants.push({ PARENT: p[0], NAME: p[1], ROLEID: role });
          return ok(true);
        }
        if (body.URI.startsWith('/Applications/DashboardParts/Console/DataSources/')) {
          const name = body.URI.split('/').at(-1);
          const rows = name === 'ConsoleTreeDT' ? tree : name === 'Roles' ? roles : name === 'ConsoleRoles' ? grants : captions;
          return json({ success: true, data: JSON.stringify({ Tables: [{ Rows: rows }] }), rowsTruncated: state.truncateMenus });
        }
        return json({ success: true, data: body.Parameters, totalRows: 12, rowsTruncated: true });
      }
      default: throw new Error('Unexpected route ' + endpoint);
    }
  }) as typeof fetch);
  return { adapter, config, calls, pending, state, tree, grants };
}

const hostOnly = ['open_form_preview', 'refresh_form_preview', 'set_preview_viewport', 'capture_form_screenshot', 'inspect_form_element', 'get_preview_console_errors', 'get_preview_load_errors', 'validate_ssl', 'get_editor_diagnostics', 'get_devtools_output'];
test('standalone exposes all server-side contracts and no desktop dependencies', async () => {
  const f = fixture();
  const actual = getProfileTools('unified', f.adapter.capabilities).map(t => t.id);
  const expected = getProfileTools('devtools').map(t => t.id).filter(id => !hostOnly.includes(id));
  assert.deepEqual(new Set(actual), new Set(expected));
  assert.equal(actual.length + 1, 29);
  const ro = fixture('read-only');
  const readTools = getProfileTools('unified', ro.adapter.capabilities);
  assert.equal(readTools.length + 1, 14);
  assert.ok(readTools.every(t => t.risk === 'read'));
  for (const tool of getProfileTools('unified', f.adapter.capabilities).filter(t => t.risk !== 'read')) {
    await assert.rejects(ro.adapter.invoke(tool.id, {}), /read-only/);
  }
  assert.equal(ro.calls.length, 0, 'policy must reject even direct adapter calls before network I/O');
  await assert.rejects(f.adapter.invoke('capture_form_screenshot', {}), /does not implement/);
  f.config.user = 'other'; assert.equal(f.adapter.config.user, 'engineer');
});

test('logs honor user and tail limits, handle legacy text, and distinguish failure from empty', async () => {
  const f = fixture('read-only');
  const log = await f.adapter.invoke('read_log', { user: 'tester', maxLines: 2 }) as any;
  assert.equal(log.log, 'warning\nerror'); assert.equal(log.truncated, true);
  assert.equal(f.calls.at(-1)!.url.searchParams.get('URI'), '/ServerLogs/tester.log');
  for (const user of ['../x', 'x/y', 'x\\y', '\u0000']) await assert.rejects(f.adapter.invoke('read_log', { user }), /Invalid/);
  f.state.log = 'There is no log file for engineer';
  assert.equal((await f.adapter.invoke('read_log', {}) as any).empty, true);
  f.state.log = 'ERROR: real server failure';
  assert.equal((await f.adapter.invoke('read_log', {}) as any).log, f.state.log);
  for (const response of [() => new Response('legacy\nlast', { headers: { 'content-type': 'text/plain' } }), () => json('legacy\nlast')]) {
    f.state.override = c => c.endpoint === 'GetCode' ? response() : undefined;
    assert.equal((await f.adapter.invoke('read_log', { maxLines: 1 }) as any).log, 'last');
  }
  f.state.override = c => c.endpoint === 'GetCode' ? new Response('ERROR: legacy failure', { headers: { 'content-type': 'text/plain' } }) : undefined;
  assert.equal((await f.adapter.invoke('read_log', {}) as any).log, 'ERROR: legacy failure');
  for (const response of [() => json({ success: false, error: 'denied' }), () => json({ success: true, data: {} }),
    () => new Response('denied', { status: 403 }), () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{bad json', { headers: { 'content-type': 'application/json' } })]) {
    f.state.override = c => c.endpoint === 'GetCode' ? response() : undefined;
    await assert.rejects(f.adapter.invoke('read_log', {}));
  }
});

test('checkouts and history preserve XML values and reject malformed or failed responses', async () => {
  const f = fixture('read-only'); f.pending.add('script-id');
  const result = await f.adapter.invoke('list_checked_out_items', { includeAllUsers: true }) as any;
  assert.equal(result.items[0].name, 'A & B'); assert.equal(result.items[0].language, 'CHS');
  assert.equal(f.calls.at(-1)!.url.searchParams.get('allUsers'), 'true');
  await f.adapter.invoke('list_checked_out_items', {});
  assert.equal(f.calls.at(-1)!.url.searchParams.has('allUsers'), false);
  await f.adapter.invoke('query_checkin_history', { user: 'tester', dateFrom: '2026-09-01', dateTo: '2026-09-06' });
  assert.deepEqual(f.calls.at(-1)!.body.Parameters, ['tester', '2026-09-01', '2026-09-06']);
  await assert.rejects(f.adapter.invoke('query_checkin_history', { user: 'x', dateFrom: '2026-02-30', dateTo: '2026-03-01' }), /date range/);
  f.state.override = c => c.endpoint === 'GetCheckedOutItems' ? json({ success: true, data: '<Unknown/>' }) : undefined;
  await assert.rejects(f.adapter.invoke('list_checked_out_items', {}), /Invalid checkout/);
  f.state.override = c => c.endpoint === 'RunScript' ? json({ success: true, data: { success: false, error: 'not allowed' } }) : undefined;
  await assert.rejects(f.adapter.invoke('query_checkin_history', { user: 'x', dateFrom: '2026-09-01', dateTo: '2026-09-06' }), /not allowed/);
});

test('execution uses RunScript parameters and output limits without saving data sources', async () => {
  const f = fixture();
  const script = await f.adapter.invoke('execute_server_script', { uri: scriptUri, parameters: ['long output'], entryPoint: 'Run', maxCharacters: 5 }) as any;
  assert.equal(script.outputEncoding, 'text-fragment'); assert.equal(script.output.length, 5);
  assert.equal(f.calls.at(-1)!.body.EntryPoint, 'Run');
  await f.adapter.invoke('execute_data_source', { uri: '/DataSources/TOOLS/Query', parameters: [1, null], outputType: 'JSON', maxRows: 3 });
  assert.deepEqual(f.calls.at(-1)!.body, { URI: '/DataSources/TOOLS/Query', Parameters: [1, null], OutputType: 'JSON', MaxRows: 3 });
  await assert.rejects(f.adapter.invoke('execute_server_script', { uri: scriptUri, entryPoint: 'Run.other' }), /entryPoint/);
  await assert.rejects(f.adapter.invoke('execute_data_source', { uri: scriptUri }), /DataSources/);
  assert.ok(f.calls.every(c => c.endpoint !== 'SaveCode'));
  const before = f.calls.length;
  f.state.override = c => c.endpoint === 'RunScript' ? new Response('failed', { status: 500 }) : undefined;
  await assert.rejects(f.adapter.invoke('execute_server_script', { uri: scriptUri }), /HTTP 500/);
  assert.equal(f.calls.length - before, 1, 'execution must never retry automatically');
});

test('object creation uses the actual Add contract and rejects nested failures', async () => {
  const f = fixture();
  const args = { itemName: 'Sample', itemType: 'APPDS', language: 'SQL', categoryName: 'Demo', appName: 'Manager' };
  await f.adapter.invoke('create_item', args);
  assert.deepEqual(f.calls.at(-1)!.body, { lid: '/Applications/Demo/Manager', name: 'Sample', itemType: 'APPDS', ItemName: 'Sample', ItemType: 'APPDS', Language: 'SQL', Category: 'Demo', AppName: 'Manager' });
  f.state.rejectCreate = true;
  await assert.rejects(f.adapter.invoke('create_item', args), /Create item failed/);
  await assert.rejects(f.adapter.invoke('create_item', { ...args, itemType: 'UNKNOWN' }), /Unsupported/);
  await assert.rejects(f.adapter.invoke('create_table', { tableName: 'TEST', dsn: 'Database' }), /Create table failed/);
});

test('table edits require checkout, stable version and target identity, then verify semantic readback', async () => {
  const f = fixture();
  const read = await f.adapter.invoke('get_table_definition', { uri: tableUri }) as any;
  const changed = definition.replace('<Length>10</Length>', '<Length>20</Length>');
  const edit = { uri: tableUri, tableXml: changed, expectedVersion: read.version };
  await assert.rejects(f.adapter.invoke('edit_table', edit), /Check out/);
  await f.adapter.invoke('checkout_table', { uri: tableUri });
  const checkoutCount = f.calls.filter(c => c.endpoint === 'CheckOut').length;
  await f.adapter.invoke('checkout_item', { uri: tableUri });
  assert.equal(f.calls.filter(c => c.endpoint === 'CheckOut').length, checkoutCount);
  await assert.rejects(f.adapter.invoke('edit_table', { ...edit, tableXml: changed.replace('table-id', 'another-table') }), /retain the target/);
  await assert.rejects(f.adapter.invoke('edit_table', { ...edit, expectedVersion: 'stale' }), /content-version/);
  const saved = await f.adapter.invoke('edit_table', edit) as any;
  assert.equal(saved.verified, true); assert.match(f.state.definition, /FieldCaptionDTO/);
  assert.equal(tableDefinitionVersion(saved.definition), tableDefinitionVersion(changed));
  assert.ok(f.pending.has('table-id'), 'save must leave the table checked out');
  f.state.retainCheckin = true;
  await assert.rejects(f.adapter.invoke('checkin_table', { uri: tableUri, reason: 'test' }), /still checked out/);
  f.state.retainCheckin = false;
  assert.equal((await f.adapter.invoke('checkin_table', { uri: tableUri, reason: 'test' }) as any).verified, true);
  f.state.definition = definition; f.pending.add('table-id'); f.state.staleOnStatus = true;
  await assert.rejects(f.adapter.invoke('edit_table', edit), /content-version/);
  assert.equal(f.calls.filter(c => c.endpoint === 'TableSave').length, 1);
});

test('undo verifies checkout release and refuses unknown targets', async () => {
  const f = fixture(); f.pending.add('script-id'); f.state.retainUndo = true;
  await assert.rejects(f.adapter.invoke('undo_checkout', { uri: scriptUri }), /still checked out/);
  f.state.retainUndo = false;
  assert.equal((await f.adapter.invoke('undo_checkout', { uri: scriptUri }) as any).verified, true);
  await assert.rejects(f.adapter.invoke('undo_checkout', { uri: '/ServerScripts/OTHER/Hello' }), /exact target/);
  await f.adapter.invoke('create_table', { tableName: 'TEST', dsn: 'Database' });
});

test('table XML comparison catches type, caption and extra-field changes, not provider metadata', async () => {
  assert.equal(tableDefinitionVersion(definition), tableDefinitionVersion(prepareTableCaptionXml(definition).replace('<Id>f1</Id>', '<Id>f2</Id>')));
  assert.notEqual(tableDefinitionVersion(definition), tableDefinitionVersion(definition.replace('<Length>10</Length>', '<Length>20</Length>')));
  assert.notEqual(tableDefinitionVersion(definition), tableDefinitionVersion(definition.replace('CHS,值', 'CHS,其他')));
  await assert.rejects(waitForTableReadBack(async () => definition, definition.replace('<Length>10</Length>', '<Length>20</Length>'), definition, { delays: [0] }), /read-back/);
  assert.throws(() => tableDefinitionVersion('<TableDTO><Name>broken</TableDTO>'));
});

test('standalone menus plan without writes, verify creation, and reject replay hazards', async () => {
  const ro = fixture('read-only');
  const readPlan = await ro.adapter.invoke('plan_menu_item', menuInput) as any;
  assert.equal(readPlan.resolvedRoles[0].ROLEID, 'role-id'); assert.equal(ro.state.menuWrites, 0);
  await assert.rejects(ro.adapter.invoke('apply_menu_item', { planId: readPlan.planId }), /read-only/);
  const f = fixture();
  const plan = await f.adapter.invoke('plan_menu_item', menuInput) as any;
  const results = await Promise.allSettled([f.adapter.invoke('apply_menu_item', { planId: plan.planId }), f.adapter.invoke('apply_menu_item', { planId: plan.planId })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.menuWrites, 1);
  const replay = await f.adapter.invoke('apply_menu_item', { planId: plan.planId }) as any;
  assert.equal(replay.configurationVerified, true); assert.equal(replay.runtimeVerified, false); assert.equal(f.state.menuWrites, 1);
  const stale = fixture(); const p = await stale.adapter.invoke('plan_menu_item', menuInput) as any;
  stale.tree.push({ PARENT: 'Demo', NAME: 'Other', ITEMSORTER: 10 });
  await assert.rejects(stale.adapter.invoke('apply_menu_item', { planId: p.planId }), /changed/);
  assert.equal(stale.state.menuWrites, 0);
  const failed = fixture(); const p2 = await failed.adapter.invoke('plan_menu_item', menuInput) as any; failed.state.failMenu = true;
  await assert.rejects(failed.adapter.invoke('apply_menu_item', { planId: p2.planId }), /automaticRetryAllowed/);
  await assert.rejects(failed.adapter.invoke('apply_menu_item', { planId: p2.planId }), /already attempted/);
  assert.equal(failed.state.menuWrites, 1);
  const bad = fixture(); bad.state.truncateMenus = true;
  await assert.rejects(bad.adapter.invoke('get_menu_configuration', {}), /truncated/);
});

for (const policy of ['read-only', 'allow-writes'] as const) {
  test(`external HTTP MCP client discovers and invokes standalone ${policy} tools`, async t => {
    const f = fixture(policy);
    const handle = await startHttpTransport({ host: '127.0.0.1', port: 0, logger,
      createServer: () => createStarlimsMcpServer({ version: 'test', adapter: f.adapter }) });
    t.after(() => handle.close());
    const client = new Client({ name: 'external-insight', version: 'test' }); t.after(() => client.close());
    await client.connect(new StreamableHTTPClientTransport(new URL(handle.url)));
    const names = (await client.listTools()).tools.map(t => t.name);
    assert.equal(names.length, policy === 'read-only' ? 14 : 29);
    assert.ok(names.includes('read_log')); assert.ok(names.includes('get_menu_configuration'));
    assert.equal(names.includes('execute_server_script'), policy === 'allow-writes');
    const result = await client.callTool({ name: 'read_log', arguments: { maxLines: 1 } });
    assert.equal(result.isError, undefined); assert.equal((result.structuredContent as any).log, 'error');
    if (policy === 'allow-writes') {
      const executed = await client.callTool({ name: 'execute_server_script', arguments: { uri: scriptUri, parameters: [42] } });
      assert.equal(executed.isError, undefined); assert.deepEqual((executed.structuredContent as any).output, [42]);
    }
  });
}
