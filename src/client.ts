// Browser-safe server operations. The host supplies credentials, permission gates and fetch/IPC transport.
export { StarlimsHttpAdapter } from './adapters/starlims-http-adapter.js';
export { findToolContract } from './catalog.js';
export { MenuMcpService, menuRows } from './menu-service.js';
export type { MenuService, MenuScriptResult } from './menu-service.js';
export * from './table-definition.js';
export { contentVersion, normalizeFormResourcesUri, parseFormResources } from './form-resources.js';
export type { StarlimsMcpConfig } from './config.js';
