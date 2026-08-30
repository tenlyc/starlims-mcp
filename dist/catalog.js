import * as z from 'zod/v4';
const allProfiles = ['unified', 'devtools', 'vscode-compat'];
const shared = (id, title, description, risk, capability, inputSchema) => ({ id, title, description, origin: 'shared', risk, capability, schemaVersion: '1.0', profiles: allProfiles, inputSchema });
const uri = z.string().min(1).describe('STARLIMS enterprise item URI.');
const language = z.string().optional().describe('Optional STARLIMS form language identifier.');
const maxItems = z.number().int().positive().max(10_000).optional();
const maxCharacters = z.number().int().positive().max(1_000_000).optional();
export const STARLIMS_TOOL_CATALOG = [
    shared('browse_tree', 'Browse tree', 'Browse STARLIMS items below a folder URI or from the root.', 'read', 'items.browse', z.object({ uri: z.string().optional(), maxItems })),
    shared('search_by_name', 'Search by name', 'Search STARLIMS items by name.', 'read', 'items.search', z.object({ query: z.string().min(1), itemType: z.string().optional(), exactMatch: z.boolean().optional(), maxItems })),
    shared('global_code_search', 'Global code search', 'Search for text across STARLIMS code items.', 'read', 'code.search', z.object({ searchString: z.string().min(1), itemTypes: z.array(z.string()).optional(), maxItems })),
    shared('list_languages', 'List languages', 'List available STARLIMS form languages.', 'read', 'languages.list', z.object({ maxItems })),
    shared('get_item_code', 'Read item code', 'Read authoritative code for a STARLIMS item.', 'read', 'code.read', z.object({ uri, language, maxCharacters })),
    shared('read_log', 'Read log', 'Read STARLIMS server logs.', 'read', 'logs.read', z.object({ user: z.string().optional(), maxLines: z.number().int().positive().optional() })),
    shared('get_table_definition', 'Read table definition', 'Read a STARLIMS table XML definition.', 'read', 'tables.read', z.object({ uri, maxCharacters })),
    shared('checkout_item', 'Check out item', 'Check out a STARLIMS item before editing it.', 'write', 'checkout.write', z.object({ uri, language })),
    shared('save_item', 'Save item', 'Save complete code to a checked-out STARLIMS item.', 'write', 'code.write', z.object({ uri, code: z.string(), language, expectedVersion: z.string().optional() })),
    shared('checkin_item', 'Check in item', 'Check in a STARLIMS item after edits are complete.', 'write', 'checkout.checkin', z.object({ uri, reason: z.string().min(1), language })),
    shared('undo_checkout', 'Undo checkout', 'Undo checkout for a STARLIMS item.', 'destructive', 'checkout.undo', z.object({ uri })),
    shared('execute_server_script', 'Execute server script', 'Execute a STARLIMS server script.', 'execute', 'scripts.execute', z.object({ uri, parameters: z.array(z.unknown()).optional(), outputType: z.enum(['ARRAY', 'JSON', 'XML']).optional(), entryPoint: z.string().optional(), maxCharacters })),
    shared('execute_data_source', 'Execute data source', 'Execute a STARLIMS data source.', 'execute', 'datasource.execute', z.object({ uri, parameters: z.array(z.unknown()).optional(), outputType: z.enum(['ARRAY', 'JSON', 'XML']).optional(), maxCharacters, maxRows: z.number().int().positive().optional() })),
    { id: 'list_checked_out_items', title: 'List checked-out items', description: 'List checked-out STARLIMS items.', origin: 'starlims-devtools', risk: 'read', capability: 'checkout.list', schemaVersion: '1.0', profiles: ['unified', 'devtools'], inputSchema: z.object({ includeAllUsers: z.boolean().optional() }) },
    { id: 'query_checkin_history', title: 'Query check-in history', description: 'Query STARLIMS Source Control Manager history.', origin: 'starlims-devtools', risk: 'read', capability: 'scm.history', schemaVersion: '1.0', profiles: ['unified', 'devtools'], inputSchema: z.object({ user: z.string().min(1), dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
    { id: 'refresh_checkout_tree', title: 'Refresh checkout tree', description: 'Refresh the starlimsvscode checked-out workspace mirror.', origin: 'starlimsvscode', risk: 'write', capability: 'checkout.refresh', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ includeAllUsers: z.boolean().optional() }) },
    { id: 'vscode_save_local_item', title: 'Save local workspace item', description: 'Compatibility tool that saves a starlimsvscode local working-copy path.', origin: 'starlimsvscode', risk: 'write', capability: 'code.write.local', schemaVersion: '1.0', profiles: ['vscode-compat'], adapterTool: 'save_item', inputSchema: z.object({ localPath: z.string().min(1), language }) },
    { id: 'create_item', title: 'Create item', description: 'Create a STARLIMS enterprise item.', origin: 'starlimsvscode', risk: 'write', capability: 'items.create', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ itemName: z.string().min(1), itemType: z.string().min(1), language: z.string().min(1), categoryName: z.string().min(1), appName: z.string().min(1) }) },
    { id: 'checkout_table', title: 'Check out table', description: 'Check out a STARLIMS table.', origin: 'starlimsvscode', risk: 'write', capability: 'tables.checkout', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ uri }) },
    { id: 'checkin_table', title: 'Check in table', description: 'Check in a STARLIMS table.', origin: 'starlimsvscode', risk: 'write', capability: 'tables.checkin', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ uri, reason: z.string().min(1) }) },
    { id: 'create_table', title: 'Create table', description: 'Create a STARLIMS database or dictionary table.', origin: 'starlimsvscode', risk: 'write', capability: 'tables.create', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ tableName: z.string().min(1), dsn: z.string().min(1) }) },
    { id: 'edit_table', title: 'Edit table', description: 'Save a full STARLIMS table XML definition.', origin: 'starlimsvscode', risk: 'write', capability: 'tables.write', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ uri, tableXml: z.string() }) },
    { id: 'run_integration_tests', title: 'Run integration tests', description: 'Run host integration tests after explicit local approval.', origin: 'starlimsvscode', risk: 'execute', capability: 'tests.run', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ reason: z.string().optional(), maxCharacters }) },
    { id: 'transfer_item_to_server', title: 'Transfer items to server', description: 'Transfer checked-out items to another configured STARLIMS server.', origin: 'starlimsvscode', risk: 'write', capability: 'transfer.run', schemaVersion: '1.0', profiles: ['unified', 'vscode-compat'], inputSchema: z.object({ targetServer: z.string().min(1), saveLocalEdits: z.boolean().optional() }) }
];
export function getProfileTools(profile, capabilities) {
    const supported = capabilities ? new Set(capabilities) : undefined;
    return STARLIMS_TOOL_CATALOG.filter((tool) => tool.profiles.includes(profile) && (!supported || supported.has(tool.capability)));
}
export function findToolContract(id) {
    return STARLIMS_TOOL_CATALOG.find((tool) => tool.id === id);
}
//# sourceMappingURL=catalog.js.map