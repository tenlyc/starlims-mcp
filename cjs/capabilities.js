"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCapabilityDocument = buildCapabilityDocument;
const catalog_js_1 = require("./catalog.js");
async function buildCapabilityDocument(options) {
    const tools = (0, catalog_js_1.getProfileTools)(options.profile, options.adapter.capabilities);
    const backend = options.adapter.backendComponents ? await options.adapter.backendComponents() : [];
    return {
        server: options.serverName || 'starlims-mcp',
        version: options.version,
        serverProvenance: {
            repository: 'https://github.com/tenlyc/starlims-mcp',
            owner: 'tenlyc/starlims-mcp',
            license: 'MIT',
            relationship: 'original'
        },
        profile: options.profile,
        adapter: options.adapter.id,
        capabilities: [...options.adapter.capabilities],
        tools: tools.map(({ id, title, origin, provenance, risk, capability, schemaVersion, profiles }) => ({ id, title, origin, provenance, risk, capability, schemaVersion, profiles })),
        backend: [...backend]
    };
}
//# sourceMappingURL=capabilities.js.map