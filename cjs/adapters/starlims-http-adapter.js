"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarlimsHttpAdapter = void 0;
const form_resources_js_1 = require("../form-resources.js");
const READ_CAPABILITIES = [
    'items.browse', 'items.search', 'code.search', 'languages.list', 'code.read',
    'forms.resources.read', 'tables.read'
];
const WRITE_CAPABILITIES = ['checkout.write', 'code.write', 'forms.resources.write', 'checkout.checkin'];
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
class StarlimsHttpAdapter {
    config;
    logger;
    fetchImpl;
    id = 'starlims-http';
    capabilities;
    backendVersion;
    connected = false;
    constructor(config, logger, fetchImpl = fetch) {
        this.config = config;
        this.logger = logger;
        this.fetchImpl = fetchImpl;
        this.capabilities = config.permissionPolicy === 'allow-writes'
            ? [...READ_CAPABILITIES, ...WRITE_CAPABILITIES]
            : [...READ_CAPABILITIES];
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
        if (!this.connected)
            await this.connect();
        switch (tool) {
            case 'browse_tree': return this.browseTree(arguments_);
            case 'search_by_name': return this.searchByName(arguments_);
            case 'global_code_search': return this.globalCodeSearch(arguments_);
            case 'list_languages': return this.listLanguages(arguments_);
            case 'get_item_code': return this.getItemCodeTool(arguments_);
            case 'get_table_definition': return this.getTableDefinition(arguments_);
            case 'get_form_resources': return this.getFormResources(arguments_);
            case 'checkout_item': return this.checkout(arguments_);
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
                accept: 'application/json',
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
            throw new Error(`SCM_API.${endpoint} returned a non-JSON response.`);
        }
        const object = objectValue(result);
        if (object.success === false)
            throw new Error(String(object.message || object.error || object.data || `SCM_API.${endpoint} failed.`));
        return object;
    }
    normalizeItems(result) {
        const data = objectValue(result.data);
        return arrayValue(data.items).length ? arrayValue(data.items) : arrayValue(result.data);
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
        return { code: /\/(?:HTMLForms|XFDForms)\/Resources\//i.test(uri) ? (0, form_resources_js_1.decodeFormResourcePayload)(code) : code, language: data.language ? String(data.language) : undefined };
    }
    async getItemCodeTool(args) {
        const uri = String(args.uri || '');
        const language = this.language(args.language);
        const code = await this.readCode(uri, language);
        const bounded = truncate(code.code, args.maxCharacters);
        return { uri, language: code.language || language, code: bounded.value, version: (0, form_resources_js_1.contentVersion)(code.code), totalCharacters: bounded.totalCharacters, truncated: bounded.truncated };
    }
    async getTableDefinition(args) {
        const uri = String(args.uri || '');
        const response = await this.request('TableGetById', { query: { URI: uri } });
        const definition = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? null);
        const bounded = truncate(definition, args.maxCharacters);
        return { uri, definition: bounded.value, version: (0, form_resources_js_1.contentVersion)(definition), totalCharacters: bounded.totalCharacters, truncated: bounded.truncated };
    }
    async getFormResources(args) {
        const uri = (0, form_resources_js_1.normalizeFormResourcesUri)(String(args.uri || ''));
        const language = this.language(args.language);
        const parsed = (0, form_resources_js_1.parseFormResources)((await this.readCode(uri, language)).code);
        const bounded = truncate(parsed.xml, args.maxCharacters);
        return { uri, language, version: (0, form_resources_js_1.contentVersion)(parsed.xml), resources: parsed.resources, totalItems: parsed.resources.length, ...(args.includeXml === true ? { resourceXml: bounded.value, totalCharacters: bounded.totalCharacters, truncated: bounded.truncated } : {}) };
    }
    async checkout(args) {
        this.assertWriteAllowed('checkout_item');
        const uri = String(args.uri || '');
        const language = this.language(args.language);
        const response = await this.request('CheckOut', { query: { URI: uri, UserLang: language } });
        return { uri, language, checkedOut: response.success !== false, localPath: response.localPath };
    }
    async saveVerified(uri, language, code, expectedVersion, semantic = false) {
        this.assertWriteAllowed('save_item');
        const before = (await this.readCode(uri, language)).code;
        const beforeVersion = (0, form_resources_js_1.contentVersion)(before);
        if (expectedVersion && expectedVersion !== beforeVersion)
            throw new Error('Remote content changed after it was read; save was blocked by the content-version gate.');
        await this.request('SaveCode', { method: 'POST', body: { URI: uri, Code: code, UserLang: language } });
        const after = (await this.readCode(uri, language)).code;
        const verified = semantic ? (0, form_resources_js_1.sameFormResources)(code, after) : code === after;
        if (!verified)
            throw new Error('STARLIMS save completed but read-back verification did not match the requested content.');
        return {
            uri,
            language,
            saved: true,
            previousVersion: beforeVersion,
            version: (0, form_resources_js_1.contentVersion)(after),
            fingerprint: (0, form_resources_js_1.contentVersion)(JSON.stringify({ uri, language, before, after }))
        };
    }
    saveItem(args) {
        return this.saveVerified(String(args.uri || ''), this.language(args.language), String(args.code ?? ''), args.expectedVersion ? String(args.expectedVersion) : undefined);
    }
    async checkin(args) {
        this.assertWriteAllowed('checkin_item');
        const uri = String(args.uri || '');
        const language = this.language(args.language);
        await this.request('CheckIn', { query: { URI: uri, UserLang: language, Reason: String(args.reason || '') } });
        return { uri, language, checkedIn: true };
    }
    async saveFormResources(args) {
        const uri = (0, form_resources_js_1.normalizeFormResourcesUri)(String(args.uri || ''));
        const language = this.language(args.language);
        const xml = (0, form_resources_js_1.parseFormResources)(String(args.resourceXml || '')).xml;
        return this.saveVerified(uri, language, xml, args.expectedVersion ? String(args.expectedVersion) : undefined, true);
    }
    async setFormResource(args) {
        const uri = (0, form_resources_js_1.normalizeFormResourcesUri)(String(args.uri || ''));
        const language = this.language(args.language);
        const current = (0, form_resources_js_1.parseFormResources)((await this.readCode(uri, language)).code);
        const currentVersion = (0, form_resources_js_1.contentVersion)(current.xml);
        if (args.expectedVersion && String(args.expectedVersion) !== currentVersion)
            throw new Error('Remote Form Resources changed after they were read; update was blocked.');
        const updated = (0, form_resources_js_1.setFormResourceValue)(current.xml, String(args.resourceId || ''), String(args.resourceValue ?? ''));
        const result = objectValue(await this.saveVerified(uri, language, updated.xml, currentVersion, true));
        return { ...result, resourceId: String(args.resourceId || ''), created: updated.created };
    }
}
exports.StarlimsHttpAdapter = StarlimsHttpAdapter;
//# sourceMappingURL=starlims-http-adapter.js.map