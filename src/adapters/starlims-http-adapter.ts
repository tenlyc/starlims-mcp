import { contentVersion, decodeFormResourcePayload, normalizeFormResourcesUri, parseFormResources, sameFormResources, setFormResourceValue } from '../form-resources.js';
import type { StarlimsMcpConfig } from '../config.js';
import type { StarlimsLogger } from '../logger.js';
import type { BackendComponentVersion, StarlimsMcpAdapter } from '../types.js';

type FetchLike = typeof fetch;
type JsonObject = Record<string, unknown>;

const READ_CAPABILITIES = [
  'items.browse', 'items.search', 'code.search', 'languages.list', 'code.read',
  'forms.resources.read', 'tables.read'
] as const;
const WRITE_CAPABILITIES = ['checkout.write', 'code.write', 'forms.resources.write', 'checkout.checkin'] as const;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function limit(items: unknown[], requested: unknown): unknown[] {
  const max = typeof requested === 'number' ? Math.max(1, Math.min(10_000, Math.floor(requested))) : 100;
  return items.slice(0, max);
}

function truncate(value: string, requested: unknown): { value: string; totalCharacters: number; truncated: boolean } {
  const max = typeof requested === 'number' ? Math.max(1, Math.min(1_000_000, Math.floor(requested))) : 50_000;
  return { value: value.slice(0, max), totalCharacters: value.length, truncated: value.length > max };
}

export class StarlimsHttpAdapter implements StarlimsMcpAdapter {
  readonly id = 'starlims-http';
  readonly capabilities: readonly string[];
  private backendVersion?: string;
  private connected = false;

  constructor(
    readonly config: StarlimsMcpConfig,
    private readonly logger: StarlimsLogger,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    this.capabilities = config.permissionPolicy === 'allow-writes'
      ? [...READ_CAPABILITIES, ...WRITE_CAPABILITIES]
      : [...READ_CAPABILITIES];
  }

  async connect(): Promise<void> {
    const session = await this.request('GetSessions');
    if (session.success !== true || !session.data) throw new Error('STARLIMS authentication failed: SCM_API.GetSessions did not return a valid session.');
    this.connected = true;
    try {
      const version = await this.request('Version');
      this.backendVersion = String(version.data || '');
    } catch (error) {
      this.logger.debug('SCM_API version could not be read.', error);
    }
  }

  backendComponents = (): readonly BackendComponentVersion[] => [{
    name: 'SCM_API',
    version: this.backendVersion,
    source: 'MrDoe/starlimsvscode'
  }];

  async invoke(tool: string, arguments_: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) await this.connect();
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

  private assertWriteAllowed(tool: string): void {
    if (this.config.permissionPolicy !== 'allow-writes') throw new Error(`Tool '${tool}' is blocked by the read-only server policy.`);
  }

  private language(value: unknown): string {
    return String(value || this.config.language || 'ENG').trim();
  }

  private async request(endpoint: string, options: { query?: Record<string, string>; method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<JsonObject> {
    const url = new URL(`${this.config.baseUrl}/SCM_API.${endpoint}.${this.config.urlSuffix}`);
    for (const [name, value] of Object.entries(options.query || {})) url.searchParams.set(name, value);
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
    if (!response.ok) throw new Error(`SCM_API.${endpoint} returned HTTP ${response.status}${text ? `: ${text.slice(0, 500)}` : ''}`);
    let result: unknown;
    try { result = JSON.parse(text); } catch { throw new Error(`SCM_API.${endpoint} returned a non-JSON response.`); }
    const object = objectValue(result);
    if (object.success === false) throw new Error(String(object.message || object.error || object.data || `SCM_API.${endpoint} failed.`));
    return object;
  }

  private normalizeItems(result: JsonObject): unknown[] {
    const data = objectValue(result.data);
    return arrayValue(data.items).length ? arrayValue(data.items) : arrayValue(result.data);
  }

  private async browseTree(args: Record<string, unknown>): Promise<unknown> {
    const uri = String(args.uri || '');
    const items = this.normalizeItems(await this.request('GetEnterpriseItems', { query: { URI: uri } }));
    return { uri: uri || '/', items: limit(items, args.maxItems), totalItems: items.length };
  }

  private async searchByName(args: Record<string, unknown>): Promise<unknown> {
    const query: Record<string, string> = { itemName: String(args.query || ''), exactMatch: String(args.exactMatch === true) };
    if (args.itemType) query.itemType = String(args.itemType);
    const items = this.normalizeItems(await this.request('Search', { query }));
    return { items: limit(items, args.maxItems), totalItems: items.length };
  }

  private async globalCodeSearch(args: Record<string, unknown>): Promise<unknown> {
    const types = Array.isArray(args.itemTypes) && args.itemTypes.length ? args.itemTypes.map(String).join(',') : 'ALL';
    const response = await this.request('GlobalSearch', { query: { searchString: String(args.searchString || ''), itemTypes: types } });
    const items = this.normalizeItems(response);
    return { items: limit(items, args.maxItems), totalItems: Number(objectValue(response.data).totalCount || items.length) };
  }

  private async listLanguages(args: Record<string, unknown>): Promise<unknown> {
    const response = await this.request('GetLanguages');
    const languages = arrayValue(response.data).map((language) => {
      if (Array.isArray(language)) return { id: String(language[0] || ''), name: String(language[1] || language[0] || '') };
      const item = objectValue(language);
      const id = String(item.LANGID || item.langid || item.id || '');
      return { id, name: String(item.LANGUAGE || item.language || item.name || id) };
    }).filter(({ id }) => id);
    return { languages: limit(languages, args.maxItems), totalItems: languages.length };
  }

  private async readCode(uri: string, language: string): Promise<{ code: string; language?: string }> {
    const response = await this.request('GetCode', { query: { URI: uri, UserLang: language } });
    const data = objectValue(response.data);
    const code = String(data.code || '');
    return { code: /\/(?:HTMLForms|XFDForms)\/Resources\//i.test(uri) ? decodeFormResourcePayload(code) : code, language: data.language ? String(data.language) : undefined };
  }

  private async getItemCodeTool(args: Record<string, unknown>): Promise<unknown> {
    const uri = String(args.uri || '');
    const language = this.language(args.language);
    const code = await this.readCode(uri, language);
    const bounded = truncate(code.code, args.maxCharacters);
    return { uri, language: code.language || language, code: bounded.value, version: contentVersion(code.code), totalCharacters: bounded.totalCharacters, truncated: bounded.truncated };
  }

  private async getTableDefinition(args: Record<string, unknown>): Promise<unknown> {
    const uri = String(args.uri || '');
    const response = await this.request('TableGetById', { query: { URI: uri } });
    const definition = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? null);
    const bounded = truncate(definition, args.maxCharacters);
    return { uri, definition: bounded.value, version: contentVersion(definition), totalCharacters: bounded.totalCharacters, truncated: bounded.truncated };
  }

  private async getFormResources(args: Record<string, unknown>): Promise<unknown> {
    const uri = normalizeFormResourcesUri(String(args.uri || ''));
    const language = this.language(args.language);
    const parsed = parseFormResources((await this.readCode(uri, language)).code);
    const bounded = truncate(parsed.xml, args.maxCharacters);
    return { uri, language, version: contentVersion(parsed.xml), resources: parsed.resources, totalItems: parsed.resources.length, ...(args.includeXml === true ? { resourceXml: bounded.value, totalCharacters: bounded.totalCharacters, truncated: bounded.truncated } : {}) };
  }

  private async checkout(args: Record<string, unknown>): Promise<unknown> {
    this.assertWriteAllowed('checkout_item');
    const uri = String(args.uri || '');
    const language = this.language(args.language);
    const response = await this.request('CheckOut', { query: { URI: uri, UserLang: language } });
    return { uri, language, checkedOut: response.success !== false, localPath: response.localPath };
  }

  private async saveVerified(uri: string, language: string, code: string, expectedVersion?: string, semantic = false): Promise<unknown> {
    this.assertWriteAllowed('save_item');
    const before = (await this.readCode(uri, language)).code;
    const beforeVersion = contentVersion(before);
    if (expectedVersion && expectedVersion !== beforeVersion) throw new Error('Remote content changed after it was read; save was blocked by the content-version gate.');
    await this.request('SaveCode', { method: 'POST', body: { URI: uri, Code: code, UserLang: language } });
    const after = (await this.readCode(uri, language)).code;
    const verified = semantic ? sameFormResources(code, after) : code === after;
    if (!verified) throw new Error('STARLIMS save completed but read-back verification did not match the requested content.');
    return {
      uri,
      language,
      saved: true,
      previousVersion: beforeVersion,
      version: contentVersion(after),
      fingerprint: contentVersion(JSON.stringify({ uri, language, before, after }))
    };
  }

  private saveItem(args: Record<string, unknown>): Promise<unknown> {
    return this.saveVerified(String(args.uri || ''), this.language(args.language), String(args.code ?? ''), args.expectedVersion ? String(args.expectedVersion) : undefined);
  }

  private async checkin(args: Record<string, unknown>): Promise<unknown> {
    this.assertWriteAllowed('checkin_item');
    const uri = String(args.uri || '');
    const language = this.language(args.language);
    await this.request('CheckIn', { query: { URI: uri, UserLang: language, Reason: String(args.reason || '') } });
    return { uri, language, checkedIn: true };
  }

  private async saveFormResources(args: Record<string, unknown>): Promise<unknown> {
    const uri = normalizeFormResourcesUri(String(args.uri || ''));
    const language = this.language(args.language);
    const xml = parseFormResources(String(args.resourceXml || '')).xml;
    return this.saveVerified(uri, language, xml, args.expectedVersion ? String(args.expectedVersion) : undefined, true);
  }

  private async setFormResource(args: Record<string, unknown>): Promise<unknown> {
    const uri = normalizeFormResourcesUri(String(args.uri || ''));
    const language = this.language(args.language);
    const current = parseFormResources((await this.readCode(uri, language)).code);
    const currentVersion = contentVersion(current.xml);
    if (args.expectedVersion && String(args.expectedVersion) !== currentVersion) throw new Error('Remote Form Resources changed after they were read; update was blocked.');
    const updated = setFormResourceValue(current.xml, String(args.resourceId || ''), String(args.resourceValue ?? ''));
    const result = objectValue(await this.saveVerified(uri, language, updated.xml, currentVersion, true));
    return { ...result, resourceId: String(args.resourceId || ''), created: updated.created };
  }
}
