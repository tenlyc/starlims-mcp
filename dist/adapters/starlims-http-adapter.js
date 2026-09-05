import { prepareDatabaseQuery, prepareDatabaseChange, databaseQueryResult } from '../query-database.js';
import { findToolContract } from '../catalog.js';
import { MenuMcpService } from '../menu-service.js';
import { prepareTableCaptionXml, tableDefinitionId, tableDefinitionVersion, waitForTableReadBack } from '../table-definition.js';
import { checkinTargetUri, pendingCheckoutIds, assertCheckinAccepted } from '../checkin-verification.js';
import { DOMParser } from '@xmldom/xmldom';
import { contentVersion, decodeFormResourcePayload, normalizeFormResourcesUri, parseFormResources, sameFormResources, setFormResourceValue, toProgrammaticFormResources } from '../form-resources.js';
import { ensureFormResourceBinding, inspectFormResourceBinding } from '../form-resource-binding.js';
const READ_CAPABILITIES = [
    'items.browse', 'items.search', 'code.search', 'languages.list', 'code.read',
    'forms.resources.read', 'tables.read', 'database.query', 'logs.read', 'checkout.list', 'scm.history', 'menus.read'
];
const WRITE_CAPABILITIES = ['database.change', 'checkout.write', 'code.write', 'forms.resources.write', 'checkout.checkin',
    'checkout.undo', 'items.create', 'tables.checkout', 'tables.checkin', 'tables.create', 'tables.write',
    'scripts.execute', 'datasource.execute', 'menus.write'];
function objectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}
function limit(items, requested) {
    const max = typeof requested === 'number' ? Math.max(1, Math.min(10_000, Math.floor(requested))) : 100;
    return items.slice(0, max);
}
function truncate(value, requested) {
    const max = typeof requested === 'number' ? Math.max(1, Math.min(1_000_000, Math.floor(requested))) : 50_000;
    return { value: value.slice(0, max), totalCharacters: value.length, truncated: value.length > max };
}
export class StarlimsHttpAdapter {
    config;
    logger;
    fetchImpl;
    id = 'starlims-http';
    capabilities;
    backendVersion;
    connected = false;
    menus;
    constructor(config, logger, fetchImpl = fetch) {
        this.config = config;
        this.logger = logger;
        this.fetchImpl = fetchImpl;
        // A host cannot silently switch credentials while retaining plans from another session.
        this.config = Object.freeze({ ...config });
        this.capabilities = Object.freeze(config.permissionPolicy === 'allow-writes'
            ? [...READ_CAPABILITIES, ...WRITE_CAPABILITIES]
            : [...READ_CAPABILITIES]);
        this.menus = new MenuMcpService({
            getSessionKey: () => JSON.stringify([this.config.baseUrl, this.config.user, this.config.language]),
            getItemCode: async (uri, language) => (await this.readCode(uri, language)).code,
            getLanguages: async () => {
                const result = await this.listLanguages({ maxItems: 10000 });
                return result.languages.map(item => item.id);
            },
            // These fixed internal reads do not expose arbitrary RunScript access in read-only mode.
            runDataSource: (uri, parameters, options) => this.runScript(uri, parameters, options),
            runScript: (uri, parameters, options) => {
                if (options.entryPoint !== 'ResolveForm')
                    this.assertWriteAllowed('apply_menu_item');
                return this.runScript(uri, parameters, options);
            }
        });
    }
    async connect() {
        const session = await this.request('GetSessions');
        if (session.success !== true || !session.data)
            throw new Error('STARLIMS authentication failed: SCM_API.GetSessions did not return a valid session.');
        this.connected = true;
        try {
            const version = await this.request('Version');
            this.backendVersion = String(version.data || '');
        }
        catch (error) {
            this.logger.debug('SCM_API version could not be read.', error);
        }
    }
    backendComponents = () => [{
            name: 'SCM_API',
            version: this.backendVersion,
            source: 'MrDoe/starlimsvscode'
        }];
    async invoke(tool, arguments_) {
        const contract = findToolContract(tool);
        if (!contract)
            throw new Error(`Unknown STARLIMS tool '${tool}'.`);
        if (contract.risk !== 'read')
            this.assertWriteAllowed(tool);
        if (!this.capabilities.includes(contract.capability) || !contract.profiles.includes(this.config.profile)) {
            throw new Error(`STARLIMS HTTP adapter does not implement tool '${tool}' in this profile.`);
        }
        arguments_ = contract.inputSchema.parse(arguments_);
        if (!this.connected)
            await this.connect();
        switch (tool) {
            case 'read_log': return this.readLog(arguments_);
            case 'list_checked_out_items': return this.listCheckedOutItems(arguments_);
            case 'query_checkin_history': return this.checkinHistory(arguments_);
            case 'create_item': return this.createItem(arguments_);
            case 'create_table': return this.createTable(arguments_);
            case 'edit_table': return this.editTable(arguments_);
            case 'checkout_table': return this.checkoutTable(arguments_);
            case 'checkin_table':
                this.tableUri(String(arguments_.uri));
                return this.checkin(arguments_);
            case 'undo_checkout': return this.undoCheckout(arguments_);
            case 'execute_server_script': return this.execute(arguments_, false);
            case 'execute_data_source': return this.execute(arguments_, true);
            case 'get_menu_configuration':
            case 'plan_menu_item':
            case 'apply_menu_item': return this.menus.execute(tool, arguments_);
            case 'execute_database_change': {
                this.assertWriteAllowed(tool);
                return databaseQueryResult(await this.request('McpExecuteDatabaseChange', { method: 'POST', body: prepareDatabaseChange(arguments_) }));
            }
            case 'query_database': return databaseQueryResult(await this.request('McpQueryDatabase', { method: 'POST', body: prepareDatabaseQuery(arguments_) }));
            case 'browse_tree': return this.browseTree(arguments_);
            case 'search_by_name': return this.searchByName(arguments_);
            case 'global_code_search': return this.globalCodeSearch(arguments_);
            case 'list_languages': return this.listLanguages(arguments_);
            case 'get_item_code': return this.getItemCodeTool(arguments_);
            case 'get_table_definition': return this.getTableDefinition(arguments_);
            case 'get_form_resources': return this.getFormResources(arguments_);
            case 'checkout_item': return String(arguments_.uri).startsWith('/Tables/') ? this.checkoutTable(arguments_) : this.checkout(arguments_);
            case 'save_item': return this.saveItem(arguments_);
            case 'checkin_item': return this.checkin(arguments_);
            case 'save_form_resources': return this.saveFormResources(arguments_);
            case 'set_form_resource': return this.setFormResource(arguments_);
            default: throw new Error(`STARLIMS HTTP adapter does not implement tool '${tool}'.`);
        }
    }
    assertWriteAllowed(tool) {
        if (this.config.permissionPolicy !== 'allow-writes')
            throw new Error(`Tool '${tool}' is blocked by the read-only server policy.`);
    }
    language(value) {
        return String(value || this.config.language || 'ENG').trim();
    }
    async request(endpoint, options = {}) {
        const url = new URL(`${this.config.baseUrl}/SCM_API.${endpoint}.${this.config.urlSuffix}`);
        for (const [name, value] of Object.entries(options.query || {}))
            url.searchParams.set(name, value);
        this.logger.debug(`${options.method || 'GET'} SCM_API.${endpoint}`, { url: url.toString(), user: this.config.user });
        const response = await this.fetchImpl(url, {
            method: options.method || 'GET',
            headers: {
                'content-type': 'application/json',
                accept: options.allowText ? 'application/json, text/plain' : 'application/json',
                STARLIMSUser: this.config.user,
                STARLIMSPass: this.config.password
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });
        const text = await response.text();
        if (!response.ok)
            throw new Error(`SCM_API.${endpoint} returned HTTP ${response.status}${text ? `: ${text.slice(0, 500)}` : ''}`);
        let result;
        try {
            result = JSON.parse(text);
        }
        catch {
            if (options.allowText && !/\b(?:json|html)\b/i.test(response.headers.get('content-type') || '') && !/^\s*<(?:!doctype\s+html|html)\b/i.test(text)) {
                return { success: true, data: text };
            }
            throw new Error(`SCM_API.${endpoint} returned a non-JSON response.`);
        }
        if (options.allowText && typeof result === 'string')
            return { success: true, data: result };
        const object = objectValue(result);
        if (object.success !== true)
            throw new Error(String(object.message || object.error || object.data || `SCM_API.${endpoint} returned an invalid or unsuccessful response.`));
        return object;
    }
    normalizeItems(result) {
        const data = objectValue(result.data);
        return arrayValue(data.items).length ? arrayValue(data.items) : arrayValue(result.data);
    }
    assertAccepted(response, operation) {
        let current = response;
        for (let depth = 0; depth < 5; depth++) {
            if ((depth === 0 && current.success !== true) || current.success === false ||
                (typeof current.data === 'string' && /^\s*ERROR\b/i.test(current.data))) {
                throw new Error(`${operation} failed: ${String(current.error || current.message || current.data || 'invalid response')}`);
            }
            const nested = objectValue(current.data);
            if (!('success' in nested))
                return;
            current = nested;
        }
        throw new Error(`${operation} returned too many nested response envelopes.`);
    }
    async readLog(args) {
        const user = String(args.user ?? this.config.user).trim();
        if (!user || /[\\/\u0000-\u001f]/.test(user) || user === '.' || user === '..')
            throw new Error('Invalid STARLIMS log user.');
        const response = await this.request('GetCode', { query: { URI: `/ServerLogs/${user}.log`, UserLang: this.config.language }, allowText: true });
        // A log beginning with ERROR is valid content, not a failed mutation envelope.
        if (response.success !== true)
            throw new Error('Invalid server log response.');
        const content = typeof response.data === 'string' ? response.data : objectValue(response.data).code;
        if (typeof content !== 'string')
            throw new Error('STARLIMS returned an invalid server log response.');
        const empty = !content.trim() || /^there is no log file\b/i.test(content.trim());
        const lines = empty ? [] : content.replace(/\r\n/g, '\n').split('\n');
        if (lines.at(-1) === '')
            lines.pop();
        const maxLines = Math.min(Number(args.maxLines ?? 500), 10000);
        const tail = lines.slice(-maxLines).join('\n');
        const maxCharacters = 1000000;
        const log = tail.slice(-maxCharacters);
        return { user, log, empty, totalLines: lines.length, returnedLines: log ? log.split('\n').length : 0,
            totalCharacters: content.length, truncated: lines.length > maxLines || tail.length > maxCharacters };
    }
    async listCheckedOutItems(args) {
        const response = await this.request('GetCheckedOutItems', { query: args.includeAllUsers === true ? { allUsers: 'true' } : {} });
        this.assertAccepted(response, 'Read checkouts');
        pendingCheckoutIds(response.data); // Reject unavailable status instead of reporting an empty list.
        let items;
        if (typeof response.data === 'string') {
            const doc = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(response.data, 'application/xml');
            items = Array.from(doc.getElementsByTagName('*')).filter(node => node.localName === 'PendingCheckins').map(row => {
                const fields = Object.fromEntries(Array.from(row.childNodes).filter(node => node.nodeType === 1).map(node => [node.nodeName, node.textContent || '']));
                return { ...fields, guid: fields.CHILDID, name: fields.CHILDNAME, type: fields.CHILDTYPE,
                    checkedOutBy: fields.CHECKEDOUTBY, checkedOutDate: fields.CHECKEDOUTDATE, language: fields.LANGID || null };
            });
        }
        else
            items = this.normalizeItems(response);
        return { items, totalItems: items.length, includeAllUsers: args.includeAllUsers === true };
    }
    async checkinHistory(args) {
        const filter = { user: String(args.user), dateFrom: String(args.dateFrom), dateTo: String(args.dateTo) };
        const validDate = (date) => { const value = new Date(`${date}T00:00:00Z`); return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date; };
        if (!validDate(filter.dateFrom) || !validDate(filter.dateTo) || filter.dateFrom > filter.dateTo)
            throw new Error('Invalid inclusive check-in history date range.');
        const result = await this.runScript('/ServerScripts/SCM_API/McpGetCheckInHistory', [filter.user, filter.dateFrom, filter.dateTo]);
        const payload = objectValue(result.output);
        if (payload.success === false || !Array.isArray(payload.items))
            throw new Error(String(payload.error || 'Invalid check-in history response; install compatible SCM_API.McpGetCheckInHistory.'));
        return { filter, items: payload.items, totalItems: payload.items.length };
    }
    async runScript(uri, parameters, options = {}) {
        const started = Date.now();
        const response = await this.request('RunScript', { method: 'POST', body: {
                URI: uri, Parameters: parameters, EntryPoint: options.entryPoint, OutputType: options.outputType || 'ARRAY', MaxRows: options.maxRows
            } });
        if (response.success !== true)
            throw new Error('Invalid RunScript response. Execution may have occurred; do not automatically retry.');
        return { success: true, output: response.data ?? null, executionTime: Date.now() - started,
            totalRows: typeof response.totalRows === 'number' ? response.totalRows : undefined, rowsTruncated: response.rowsTruncated === true };
    }
    async execute(args, dataSource) {
        const uri = String(args.uri);
        const folder = dataSource ? 'DataSources' : 'ServerScripts';
        if (!new RegExp(`^/(?:${folder}/[^/]+|Applications/[^/]+/[^/]+/${folder})/[^/]+$`).test(uri))
            throw new Error(`Expected a ${folder} item URI.`);
        if (args.entryPoint !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(args.entryPoint)))
            throw new Error('entryPoint must name one server procedure.');
        const outputType = String(args.outputType || 'ARRAY');
        const result = await this.runScript(uri, args.parameters || [], {
            entryPoint: args.entryPoint, outputType,
            ...(dataSource ? { maxRows: Math.min(Number(args.maxRows ?? 100), 10000) } : {})
        });
        const text = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
        const bounded = truncate(text, args.maxCharacters);
        return { uri, ...result, output: bounded.truncated ? bounded.value : result.output, outputType,
            totalCharacters: bounded.totalCharacters, truncated: bounded.truncated, outputEncoding: bounded.truncated ? 'text-fragment' : 'native' };
    }
    async createItem(args) {
        const itemName = String(args.itemName).trim(), itemType = String(args.itemType).trim().toUpperCase();
        const categoryName = String(args.categoryName).trim(), appName = String(args.appName).trim();
        const language = String(args.language).trim();
        const types = ['APPCATEGORY', 'APP', 'HTMLFORMXML', 'XFDFORMXML', 'APPSS', 'APPDS', 'APPCS', 'SS', 'DS', 'CS', 'SSCATEGORY', 'SSCAT', 'DSCATEGORY', 'DSCAT', 'CSCATEGORY', 'CSCAT'];
        if (!types.includes(itemType))
            throw new Error(`Unsupported create item type '${itemType}'.`);
        if ([itemName, categoryName, appName].some(value => !value || /[\\/\u0000-\u001f]/.test(value) || value === '.' || value === '..'))
            throw new Error('Invalid item, category or application name.');
        if (!language)
            throw new Error('An explicit item language is required.');
        const parentUri = itemType === 'APPCATEGORY' ? '/Applications' : itemType === 'APP' ? `/Applications/${categoryName}`
            : ['HTMLFORMXML', 'XFDFORMXML', 'APPSS', 'APPDS', 'APPCS'].includes(itemType) ? `/Applications/${categoryName}/${appName}`
                : itemType.startsWith('SS') ? `/ServerScripts${itemType === 'SS' ? '/' + categoryName : ''}`
                    : itemType.startsWith('DS') ? `/DataSources${itemType === 'DS' ? '/' + categoryName : ''}`
                        : `/ClientScripts${itemType === 'CS' ? '/' + categoryName : ''}`;
        const response = await this.request('Add', { method: 'POST', body: {
                lid: parentUri, name: itemName, itemType, ItemName: itemName, ItemType: itemType, Language: language,
                Category: categoryName, AppName: appName
            } });
        this.assertAccepted(response, 'Create item');
        return { created: true, itemName, itemType, categoryName, appName, language, parentUri, runtimeVerified: false };
    }
    tableUri(uri) {
        if (!/^\/Tables\/[^/]+\/[^/]+$/.test(uri))
            throw new Error('Expected /Tables/<connection>/<table> URI.');
        return uri;
    }
    async readTableXml(uri) {
        const response = await this.request('TableGetById', { query: { URI: uri } });
        this.assertAccepted(response, 'Read table');
        if (typeof response.data !== 'string' || !response.data.trim())
            throw new Error('STARLIMS returned no editable table definition.');
        tableDefinitionVersion(response.data);
        return response.data;
    }
    async checkoutStatus() {
        const response = await this.request('GetCheckedOutItems');
        this.assertAccepted(response, 'Read checkouts');
        return pendingCheckoutIds(response.data);
    }
    async checkoutTable(args) {
        const uri = this.tableUri(String(args.uri)), id = tableDefinitionId(await this.readTableXml(uri));
        if (!id)
            throw new Error('Table definition has no target Id.');
        const hasTarget = (ids) => ids.includes(id.toLowerCase()) || ids.includes(uri.toLowerCase());
        if (hasTarget(await this.checkoutStatus()))
            return { uri, checkedOut: true, alreadyCheckedOut: true };
        this.assertAccepted(await this.request('CheckOut', { query: { URI: uri } }), 'Table checkout');
        if (!hasTarget(await this.checkoutStatus()))
            throw new Error('Table checkout was not verified by read-back.');
        return { uri, checkedOut: true, verified: true };
    }
    async createTable(args) {
        const tableName = String(args.tableName).trim().toUpperCase(), dsn = String(args.dsn).trim();
        const uri = this.tableUri(`/Tables/${dsn}/${tableName}`);
        if (!tableName || !dsn || /[\\\u0000-\u001f]/.test(uri))
            throw new Error('Invalid table name or connection.');
        const response = await this.request('TableAdd', { method: 'POST', body: { TableName: tableName, Dsn: dsn } });
        this.assertAccepted(response, 'Create table');
        const definition = await this.readTableXml(uri);
        return { uri, created: true, tableName, dsn, verified: true, version: contentVersion(tableDefinitionVersion(definition)), result: response.data };
    }
    async editTable(args) {
        const uri = this.tableUri(String(args.uri)), requested = prepareTableCaptionXml(String(args.tableXml));
        const before = await this.readTableXml(uri), id = tableDefinitionId(before);
        if (!id || tableDefinitionId(requested).toLowerCase() !== id.toLowerCase())
            throw new Error('The submitted TableDTO must retain the target table Id.');
        const version = (xml) => contentVersion(tableDefinitionVersion(xml));
        const assertVersion = (xml) => { if (args.expectedVersion !== version(xml))
            throw new Error('Remote table changed after it was read; save blocked by content-version gate.'); };
        assertVersion(before);
        const pending = await this.checkoutStatus();
        if (!pending.includes(id.toLowerCase()) && !pending.includes(uri.toLowerCase()))
            throw new Error('Check out the table before saving its definition.');
        assertVersion(await this.readTableXml(uri));
        const response = await this.request('TableSave', { method: 'POST', body: { URI: uri, TableXml: requested } });
        this.assertAccepted(response, 'Save table');
        const definition = await waitForTableReadBack(() => this.readTableXml(uri), requested, before);
        return { uri, saved: true, verified: true, definition, version: version(definition), result: response.data };
    }
    async undoCheckout(args) {
        const uri = checkinTargetUri(String(args.uri)), guid = await this.resolveTargetId(uri);
        const hasTarget = (ids) => ids.includes(guid.toLowerCase()) || ids.includes(uri.toLowerCase());
        if (!hasTarget(await this.checkoutStatus()))
            throw new Error('The target is not checked out by the current user. No undo was submitted.');
        this.assertAccepted(await this.request('UndoCheckOut', { query: { URI: uri } }), 'Undo checkout');
        if (hasTarget(await this.checkoutStatus()))
            throw new Error('Undo checkout returned success but the target is still checked out. Do not automatically retry.');
        return { uri, undone: true, verified: true };
    }
    async resolveTargetId(uri) {
        if (uri.startsWith('/Tables/')) {
            const id = tableDefinitionId(await this.readTableXml(this.tableUri(uri)));
            if (id)
                return id;
        }
        else {
            const items = this.normalizeItems(await this.request('Search', { query: { itemName: uri.slice(uri.lastIndexOf('/') + 1), exactMatch: 'true' } })).map(objectValue);
            const guid = items.find(item => checkinTargetUri(String(item.uri || item.id)).toLowerCase() === uri.toLowerCase())?.guid;
            if (typeof guid === 'string' && guid)
                return guid;
            if (/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(uri))
                return uri;
        }
        throw new Error('Cannot resolve the exact target GUID. No mutation was submitted.');
    }
    async browseTree(args) {
        const uri = String(args.uri || '');
        const items = this.normalizeItems(await this.request('GetEnterpriseItems', { query: { URI: uri } }));
        return { uri: uri || '/', items: limit(items, args.maxItems), totalItems: items.length };
    }
    async searchByName(args) {
        const query = { itemName: String(args.query || ''), exactMatch: String(args.exactMatch === true) };
        if (args.itemType)
            query.itemType = String(args.itemType);
        const items = this.normalizeItems(await this.request('Search', { query }));
        return { items: limit(items, args.maxItems), totalItems: items.length };
    }
    async globalCodeSearch(args) {
        const types = Array.isArray(args.itemTypes) && args.itemTypes.length ? args.itemTypes.map(String).join(',') : 'ALL';
        const response = await this.request('GlobalSearch', { query: { searchString: String(args.searchString || ''), itemTypes: types } });
        const items = this.normalizeItems(response);
        return { items: limit(items, args.maxItems), totalItems: Number(objectValue(response.data).totalCount || items.length) };
    }
    async listLanguages(args) {
        const response = await this.request('GetLanguages');
        const languages = arrayValue(response.data).map((language) => {
            if (Array.isArray(language))
                return { id: String(language[0] || ''), name: String(language[1] || language[0] || '') };
            const item = objectValue(language);
            const id = String(item.LANGID || item.langid || item.id || '');
            return { id, name: String(item.LANGUAGE || item.language || item.name || id) };
        }).filter(({ id }) => id);
        return { languages: limit(languages, args.maxItems), totalItems: languages.length };
    }
    async readCode(uri, language) {
        const response = await this.request('GetCode', { query: { URI: uri, UserLang: language } });
        const data = objectValue(response.data);
        const code = String(data.code || '');
        return { code: /\/(?:HTMLForms|XFDForms)\/Resources\//i.test(uri) ? decodeFormResourcePayload(code) : code, language: data.language ? String(data.language) : undefined };
    }
    async getItemCodeTool(args) {
        const uri = String(args.uri || '');
        const language = this.language(args.language);
        const code = await this.readCode(uri, language);
        const bounded = truncate(code.code, args.maxCharacters);
        return { uri, language: code.language || language, code: bounded.value, version: contentVersion(code.code), totalCharacters: bounded.totalCharacters, truncated: bounded.truncated };
    }
    async getTableDefinition(args) {
        const uri = String(args.uri || '');
        const definition = await this.readTableXml(uri);
        const bounded = truncate(definition, args.maxCharacters);
        return { uri, definition: bounded.value, version: contentVersion(tableDefinitionVersion(definition)), totalCharacters: bounded.totalCharacters, truncated: bounded.truncated };
    }
    async getFormResources(args) {
        const uri = normalizeFormResourcesUri(String(args.uri || ''));
        const language = this.language(args.language);
        const parsed = parseFormResources((await this.readCode(uri, language)).code);
        const bounded = truncate(parsed.xml, args.maxCharacters);
        return { uri, language, format: parsed.format, formDiagnostics: await this.inspectHtmlFormResources(uri, language), runtimeVerified: false, version: contentVersion(parsed.xml), resources: parsed.resources, totalItems: parsed.resources.length, ...(args.includeXml === true ? { resourceXml: bounded.value, totalCharacters: bounded.totalCharacters, truncated: bounded.truncated } : {}) };
    }
    async checkout(args) {
        this.assertWriteAllowed('checkout_item');
        const uri = String(args.uri || '');
        const language = this.language(args.language);
        if (/\/(HTMLForms|XFDForms)\//i.test(uri)) {
            const targetUri = checkinTargetUri(uri);
            const items = this.normalizeItems(await this.request('Search', { query: { itemName: targetUri.slice(targetUri.lastIndexOf('/') + 1), exactMatch: 'true' } })).map(objectValue);
            const guid = items.find(item => checkinTargetUri(String(item.uri || item.id)).toLowerCase() === targetUri.toLowerCase())?.guid;
            if (typeof guid !== 'string')
                throw new Error('Cannot resolve form family GUID; no checkout was performed.');
            const status = await this.request('GetCheckedOutItems');
            if (status.success !== true)
                throw new Error('Checkout status unavailable; no checkout was performed.');
            const pending = pendingCheckoutIds(status.data);
            if (pending.includes(guid.toLowerCase()) || pending.includes(targetUri.toLowerCase())) {
                const checkoutLanguage = await this.formCheckoutLanguage(guid, targetUri);
                if (args.language && checkoutLanguage !== language)
                    throw new Error(`Form family is already checked out in ${checkoutLanguage || 'an unverified language'}; no checkout was performed. Preserve the existing working copy before changing language.`);
                return { uri, checkedOut: true, alreadyCheckedOut: true, checkoutLanguage };
            }
        }
        const response = await this.request('CheckOut', { query: { URI: uri, UserLang: language } });
        return { uri, language, checkedOut: response.success !== false, localPath: response.localPath };
    }
    async saveVerified(uri, language, code, expectedVersion, semantic = false) {
        this.assertWriteAllowed('save_item');
        const before = (await this.readCode(uri, language)).code;
        const beforeVersion = contentVersion(before);
        if (expectedVersion && expectedVersion !== beforeVersion)
            throw new Error('Remote content changed after it was read; save was blocked by the content-version gate.');
        await this.request('SaveCode', { method: 'POST', body: { URI: uri, Code: code, UserLang: language } });
        const after = (await this.readCode(uri, language)).code;
        const verified = semantic ? sameFormResources(code, after) : code === after;
        if (!verified)
            throw new Error('STARLIMS save completed but read-back verification did not match the requested content.');
        return {
            uri,
            language,
            saved: true,
            previousVersion: beforeVersion,
            version: contentVersion(after),
            fingerprint: contentVersion(JSON.stringify({ uri, language, before, after }))
        };
    }
    saveItem(args) {
        return this.saveVerified(String(args.uri || ''), this.language(args.language), String(args.code ?? ''), args.expectedVersion ? String(args.expectedVersion) : undefined);
    }
    async checkin(args) {
        this.assertWriteAllowed('checkin_item');
        const uri = String(args.uri || '');
        const targetUri = checkinTargetUri(uri);
        const language = this.language(args.language);
        const guid = await this.resolveTargetId(targetUri);
        const status = async () => {
            const response = await this.request('GetCheckedOutItems');
            if (response.success !== true)
                throw new Error('Checkout status request failed.');
            return pendingCheckoutIds(response.data);
        };
        const hasTarget = (ids) => ids.includes(guid.toLowerCase()) || ids.includes(targetUri.toLowerCase());
        if (!hasTarget(await status()))
            throw new Error('The target is not checked out by the current user. No check-in was submitted.');
        const response = await this.request('CheckIn', { query: { URI: targetUri, UserLang: language, Reason: String(args.reason || '') } });
        assertCheckinAccepted(response);
        if (hasTarget(await status()))
            throw new Error('CheckIn returned success but the target is still checked out. Check-in was not verified; inspect the backend result before retrying.');
        return { uri, targetUri, language, guid, checkedIn: true, verified: true, verification: 'checkout_released' };
    }
    async saveFormResources(args) {
        const uri = normalizeFormResourcesUri(String(args.uri || ''));
        const language = this.language(args.language);
        const current = parseFormResources((await this.readCode(uri, language)).code);
        const currentVersion = contentVersion(current.xml);
        if (args.expectedVersion && String(args.expectedVersion) !== currentVersion)
            throw new Error('Remote Form Resources changed after they were read; update was blocked.');
        const xml = toProgrammaticFormResources(String(args.resourceXml || ''), current.xml);
        const binding = await this.prepareHtmlFormResourceBinding(uri, language);
        const result = objectValue(await this.saveVerified(uri, language, xml, currentVersion, true));
        const bindingResult = await this.saveHtmlFormResourceBinding(binding);
        return {
            ...result,
            ...bindingResult,
            formDiagnostics: await this.inspectHtmlFormResources(uri, language),
            runtimeVerified: false,
            workingCopyUpdated: true,
            designerReloadRequired: true,
            runtimeSyncRequiresCheckIn: true,
            nextStep: 'Close and reopen the already-open HTML Form Designer tab to reload its cached Resources grid. Check In only after validation to synchronize runtime resources.'
        };
    }
    async setFormResource(args) {
        const uri = normalizeFormResourcesUri(String(args.uri || ''));
        const language = this.language(args.language);
        const current = parseFormResources((await this.readCode(uri, language)).code);
        const currentVersion = contentVersion(current.xml);
        if (args.expectedVersion && String(args.expectedVersion) !== currentVersion)
            throw new Error('Remote Form Resources changed after they were read; update was blocked.');
        const updated = setFormResourceValue(current.xml, String(args.resourceId || ''), String(args.resourceValue ?? ''));
        const binding = await this.prepareHtmlFormResourceBinding(uri, language);
        const result = objectValue(await this.saveVerified(uri, language, updated.xml, currentVersion, true));
        const bindingResult = await this.saveHtmlFormResourceBinding(binding);
        return {
            ...result,
            ...bindingResult,
            formDiagnostics: await this.inspectHtmlFormResources(uri, language),
            runtimeVerified: false,
            resourceId: String(args.resourceId || ''),
            created: updated.created,
            workingCopyUpdated: true,
            designerReloadRequired: true,
            runtimeSyncRequiresCheckIn: true,
            nextStep: 'Close and reopen the already-open HTML Form Designer tab to reload its cached Resources grid. Check In only after validation to synchronize runtime resources.'
        };
    }
    async formCheckoutLanguage(formId, uri) {
        const response = await this.request('GetCheckedOutItems');
        if (typeof response.data === 'string') {
            const doc = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(response.data, 'application/xml');
            for (const row of Array.from(doc.getElementsByTagName('PendingCheckins'))) {
                const id = row.getElementsByTagName('CHILDID')[0]?.textContent;
                if (id?.toLowerCase() === formId.toLowerCase())
                    return row.getElementsByTagName('LANGID')[0]?.textContent || null;
            }
            return null;
        }
        const item = this.normalizeItems(response).map(objectValue).find((item) => String(item.guid || item.id).toLowerCase() === formId.toLowerCase() || item.uri === uri);
        return typeof item?.language === 'string' ? item.language : null;
    }
    async inspectHtmlFormResources(resourceUri, language) {
        if (!resourceUri.includes('/HTMLForms/Resources/'))
            return { status: 'not_applicable', runtimeVerified: false };
        try {
            const uri = resourceUri.replace('/Resources/', '/XML/');
            const name = uri.slice(uri.lastIndexOf('/') + 1);
            const items = this.normalizeItems(await this.request('Search', { query: { itemName: name, exactMatch: 'true' } })).map(objectValue);
            const formId = items.find((item) => String(item.uri || item.id) === uri)?.guid;
            if (typeof formId !== 'string')
                throw new Error('Enterprise GUID could not be resolved.');
            const checkoutLanguage = await this.formCheckoutLanguage(formId, uri);
            return { uri, checkoutLanguage, writableInRequestedLanguage: checkoutLanguage ? checkoutLanguage === language : null, ...inspectFormResourceBinding((await this.readCode(uri, language)).code, formId, language) };
        }
        catch (error) {
            return { status: 'unavailable', warnings: [error instanceof Error ? error.message : String(error)], runtimeVerified: false };
        }
    }
    async prepareHtmlFormResourceBinding(resourceUri, language) {
        if (!resourceUri.includes('/HTMLForms/Resources/'))
            return undefined;
        const uri = resourceUri.replace('/Resources/', '/XML/');
        const name = uri.slice(uri.lastIndexOf('/') + 1);
        const items = this.normalizeItems(await this.request('Search', { query: { itemName: name, exactMatch: 'true' } })).map(objectValue);
        const formId = items.find((item) => String(item.uri || item.id) === uri)?.guid;
        if (typeof formId !== 'string')
            throw new Error('Cannot verify the HTML form GUID from the enterprise tree. Resources save was blocked.');
        const checkoutLanguage = await this.formCheckoutLanguage(formId, uri);
        if (checkoutLanguage && checkoutLanguage !== language)
            throw new Error(`Form Resources language ${language} does not match the verified checkout language ${checkoutLanguage || '(not checked out)'}. Resolve the checkout language before saving; no resource data was written.`);
        const before = (await this.readCode(uri, language)).code;
        return { uri, formId, language, before, ...ensureFormResourceBinding(before, formId, language) };
    }
    async saveHtmlFormResourceBinding(binding) {
        if (!binding)
            return { formBindingVerified: false, formBindingUpdated: false };
        if (binding.changed)
            await this.saveVerified(binding.uri, binding.language, binding.xml, contentVersion(binding.before));
        const actual = (await this.readCode(binding.uri, binding.language)).code;
        if (ensureFormResourceBinding(actual, binding.formId, binding.language).changed) {
            throw new Error('Resources were saved, but the HTML Form loading binding could not be verified. Read both documents before retrying.');
        }
        return { formBindingVerified: true, formBindingUpdated: binding.changed };
    }
}
//# sourceMappingURL=starlims-http-adapter.js.map