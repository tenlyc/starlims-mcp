import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCapabilityDocument, findToolContract, getProfileTools, STARLIMS_TOOL_CATALOG } from '../index.js';
test('catalog has unique ids and explicit provenance', () => {
    const ids = STARLIMS_TOOL_CATALOG.map((tool) => tool.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(STARLIMS_TOOL_CATALOG.every((tool) => tool.origin && tool.capability && tool.schemaVersion));
    assert.ok(STARLIMS_TOOL_CATALOG.every((tool) => tool.provenance.repository && tool.provenance.owner && tool.provenance.license));
    assert.equal(findToolContract('browse_tree')?.provenance.repository, 'https://github.com/MrDoe/starlimsvscode');
    assert.equal(findToolContract('get_form_resources')?.provenance.repository, 'https://github.com/tenlyc/starlims-mcp');
    assert.equal(findToolContract('list_checked_out_items')?.provenance.repository, 'https://github.com/tenlyc/starlims-devtools');
});
test('profiles preserve host compatibility without conflicting save schemas', () => {
    const devtools = getProfileTools('devtools').map((tool) => tool.id);
    const vscode = getProfileTools('vscode-compat').map((tool) => tool.id);
    assert.ok(devtools.includes('save_item'));
    assert.ok(!devtools.includes('vscode_save_local_item'));
    assert.ok(vscode.includes('vscode_save_local_item'));
    assert.ok(vscode.includes('save_item'));
    assert.ok(devtools.includes('get_form_resources'));
    assert.ok(devtools.includes('save_form_resources'));
    assert.ok(devtools.includes('set_form_resource'));
});
test('capability document exposes only tools implemented by the adapter', async () => {
    const document = await buildCapabilityDocument({
        version: '0.1.0',
        profile: 'unified',
        adapter: {
            id: 'test-adapter',
            capabilities: ['items.browse', 'code.read'],
            invoke: async () => undefined,
            backendComponents: () => [{ name: 'SCM_API', version: '1.8.2', source: 'MrDoe/starlimsvscode', commit: '92b9014' }]
        }
    });
    assert.deepEqual(document.tools.map((tool) => tool.id), ['browse_tree', 'get_item_code']);
    assert.equal(document.backend[0]?.name, 'SCM_API');
    assert.equal(document.serverProvenance.repository, 'https://github.com/tenlyc/starlims-mcp');
    assert.equal(document.tools[0]?.provenance.repository, 'https://github.com/MrDoe/starlimsvscode');
});
//# sourceMappingURL=catalog.test.js.map