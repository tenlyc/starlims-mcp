import { checkinTargetUri, pendingCheckoutIds, assertCheckinAccepted } from '../checkin-verification.js';
import { DOMParser } from '@xmldom/xmldom';
import { contentVersion, decodeFormResourcePayload, normalizeFormResourcesUri, parseFormResources, sameFormResources, setFormResourceValue, toProgrammaticFormResources } from '../form-resources.js';
import { ensureFormResourceBinding, inspectFormResourceBinding } from '../form-resource-binding.js';
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
    return { uri, language, format: parsed.format, formDiagnostics: await this.inspectHtmlFormResources(uri, language), runtimeVerified: false, version: contentVersion(parsed.xml), resources: parsed.resources, totalItems: parsed.resources.length, ...(args.includeXml === true ? { resourceXml: bounded.value, totalCharacters: bounded.totalCharacters, truncated: bounded.truncated } : {}) };
  }

  private async checkout(args: Record<string, unknown>): Promise<unknown> {
    this.assertWriteAllowed('checkout_item');
    const uri = String(args.uri || '');
    const language = this.language(args.language);
    if (/\/(HTMLForms|XFDForms)\//i.test(uri)) {
      const targetUri = checkinTargetUri(uri);
      const items = this.normalizeItems(await this.request('Search', { query: { itemName: targetUri.slice(targetUri.lastIndexOf('/') + 1), exactMatch: 'true' } })).map(objectValue);
      const guid = items.find(item => checkinTargetUri(String(item.uri || item.id)).toLowerCase() === targetUri.toLowerCase())?.guid;
      if (typeof guid !== 'string') throw new Error('Cannot resolve form family GUID; no checkout was performed.');
      const status = await this.request('GetCheckedOutItems');
      if (status.success !== true) throw new Error('Checkout status unavailable; no checkout was performed.');
      const pending = pendingCheckoutIds(status.data);
      if (pending.includes(guid.toLowerCase()) || pending.includes(targetUri.toLowerCase())) {
        const checkoutLanguage = await this.formCheckoutLanguage(guid, targetUri);
        if (args.language && checkoutLanguage !== language) throw new Error(`Form family is already checked out in ${checkoutLanguage || 'an unverified language'}; no checkout was performed. Preserve the existing working copy before changing language.`);
        return { uri, checkedOut: true, alreadyCheckedOut: true, checkoutLanguage };
      }
    }
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
    const targetUri = checkinTargetUri(uri);
    const language = this.language(args.language);
    const items = this.normalizeItems(await this.request('Search', { query: { itemName: targetUri.slice(targetUri.lastIndexOf('/') + 1), exactMatch: 'true' } })).map(objectValue);
    const guid = items.find((item) => checkinTargetUri(String(item.uri || item.id)).toLowerCase() === targetUri.toLowerCase())?.guid
      || (/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(targetUri) ? targetUri : undefined);
    if (typeof guid !== 'string') throw new Error('Cannot resolve the exact check-in target GUID. No check-in was submitted.');
    const status = async () => {
      const response = await this.request('GetCheckedOutItems');
      if (response.success !== true) throw new Error('Checkout status request failed.');
      return pendingCheckoutIds(response.data);
    };
    const hasTarget = (ids: string[]) => ids.includes(guid.toLowerCase()) || ids.includes(targetUri.toLowerCase());
    if (!hasTarget(await status())) throw new Error('The target is not checked out by the current user. No check-in was submitted.');
    const response = await this.request('CheckIn', { query: { URI: targetUri, UserLang: language, Reason: String(args.reason || '') } });
    assertCheckinAccepted(response);
    if (hasTarget(await status())) throw new Error('CheckIn returned success but the target is still checked out. Check-in was not verified; inspect the backend result before retrying.');
    return { uri, targetUri, language, guid, checkedIn: true, verified: true, verification: 'checkout_released' };
  }

  private async saveFormResources(args: Record<string, unknown>): Promise<unknown> {
    const uri = normalizeFormResourcesUri(String(args.uri || ''));
    const language = this.language(args.language);
    const current = parseFormResources((await this.readCode(uri, language)).code);
    const currentVersion = contentVersion(current.xml);
    if (args.expectedVersion && String(args.expectedVersion) !== currentVersion) throw new Error('Remote Form Resources changed after they were read; update was blocked.');
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

  private async setFormResource(args: Record<string, unknown>): Promise<unknown> {
    const uri = normalizeFormResourcesUri(String(args.uri || ''));
    const language = this.language(args.language);
    const current = parseFormResources((await this.readCode(uri, language)).code);
    const currentVersion = contentVersion(current.xml);
    if (args.expectedVersion && String(args.expectedVersion) !== currentVersion) throw new Error('Remote Form Resources changed after they were read; update was blocked.');
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

  private async formCheckoutLanguage(formId: string, uri: string): Promise<string | null> {
    const response = await this.request('GetCheckedOutItems');
    if (typeof response.data === 'string') {
      const doc = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(response.data, 'application/xml');
      for (const row of Array.from(doc.getElementsByTagName('PendingCheckins'))) {
        const id = row.getElementsByTagName('CHILDID')[0]?.textContent;
        if (id?.toLowerCase() === formId.toLowerCase()) return row.getElementsByTagName('LANGID')[0]?.textContent || null;
      }
      return null;
    }
    const item = this.normalizeItems(response).map(objectValue).find((item) => String(item.guid || item.id).toLowerCase() === formId.toLowerCase() || item.uri === uri);
    return typeof item?.language === 'string' ? item.language : null;
  }

  private async inspectHtmlFormResources(resourceUri: string, language: string) {
    if (!resourceUri.includes('/HTMLForms/Resources/')) return { status: 'not_applicable', runtimeVerified: false };
    try {
      const uri = resourceUri.replace('/Resources/', '/XML/');
      const name = uri.slice(uri.lastIndexOf('/') + 1);
      const items = this.normalizeItems(await this.request('Search', { query: { itemName: name, exactMatch: 'true' } })).map(objectValue);
      const formId = items.find((item) => String(item.uri || item.id) === uri)?.guid;
      if (typeof formId !== 'string') throw new Error('Enterprise GUID could not be resolved.');
      const checkoutLanguage = await this.formCheckoutLanguage(formId, uri);
      return { uri, checkoutLanguage, writableInRequestedLanguage: checkoutLanguage ? checkoutLanguage === language : null, ...inspectFormResourceBinding((await this.readCode(uri, language)).code, formId, language) };
    } catch (error) {
      return { status: 'unavailable', warnings: [error instanceof Error ? error.message : String(error)], runtimeVerified: false };
    }
  }

  private async prepareHtmlFormResourceBinding(resourceUri: string, language: string) {
    if (!resourceUri.includes('/HTMLForms/Resources/')) return undefined;
    const uri = resourceUri.replace('/Resources/', '/XML/');
    const name = uri.slice(uri.lastIndexOf('/') + 1);
    const items = this.normalizeItems(await this.request('Search', { query: { itemName: name, exactMatch: 'true' } })).map(objectValue);
    const formId = items.find((item) => String(item.uri || item.id) === uri)?.guid;
    if (typeof formId !== 'string') throw new Error('Cannot verify the HTML form GUID from the enterprise tree. Resources save was blocked.');
    const checkoutLanguage = await this.formCheckoutLanguage(formId, uri);
    if (checkoutLanguage && checkoutLanguage !== language) throw new Error(`Form Resources language ${language} does not match the verified checkout language ${checkoutLanguage || '(not checked out)'}. Resolve the checkout language before saving; no resource data was written.`);
    const before = (await this.readCode(uri, language)).code;
    return { uri, formId, language, before, ...ensureFormResourceBinding(before, formId, language) };
  }

  private async saveHtmlFormResourceBinding(binding: Awaited<ReturnType<StarlimsHttpAdapter['prepareHtmlFormResourceBinding']>>) {
    if (!binding) return { formBindingVerified: false, formBindingUpdated: false };
    if (binding.changed) await this.saveVerified(binding.uri, binding.language, binding.xml, contentVersion(binding.before));
    const actual = (await this.readCode(binding.uri, binding.language)).code;
    if (ensureFormResourceBinding(actual, binding.formId, binding.language).changed) {
      throw new Error('Resources were saved, but the HTML Form loading binding could not be verified. Read both documents before retrying.');
    }
    return { formBindingVerified: true, formBindingUpdated: binding.changed };
  }
}
