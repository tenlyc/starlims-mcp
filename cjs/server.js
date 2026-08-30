"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStarlimsMcpServer = createStarlimsMcpServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const z = __importStar(require("zod/v4"));
const capabilities_js_1 = require("./capabilities.js");
const catalog_js_1 = require("./catalog.js");
const annotationsFor = (risk) => ({
    readOnlyHint: risk === 'read',
    destructiveHint: risk === 'destructive',
    idempotentHint: risk === 'read' || risk === 'write',
    openWorldHint: risk === 'execute'
});
const structuredResult = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value))
        return { ok: true, ...value };
    return { ok: true, data: value };
};
function createStarlimsMcpServer(options) {
    const profile = options.profile || 'unified';
    const serverName = options.serverName || 'starlims-mcp';
    const server = new mcp_js_1.McpServer({ name: serverName, version: options.version }, {
        capabilities: { logging: {}, tools: {} },
        instructions: options.instructions || 'Use STARLIMS as the authoritative remote source. Browse or search before reading. Check out before saving. Obtain user approval for write, destructive, and execution operations.'
    });
    server.registerTool('get_capabilities', {
        title: 'Get STARLIMS MCP capabilities',
        description: 'Describe active tools, origins, risk levels, adapter capabilities, and backend component versions.',
        inputSchema: z.object({}),
        annotations: annotationsFor('read')
    }, async () => {
        const document = await (0, capabilities_js_1.buildCapabilityDocument)({ serverName, version: options.version, profile, adapter: options.adapter });
        return { content: [{ type: 'text', text: JSON.stringify(document, null, 2) }], structuredContent: document };
    });
    for (const tool of (0, catalog_js_1.getProfileTools)(profile, options.adapter.capabilities)) {
        server.registerTool(tool.id, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: annotationsFor(tool.risk)
        }, async (rawArguments) => {
            const arguments_ = (rawArguments || {});
            try {
                const value = await options.adapter.invoke(tool.adapterTool || tool.id, arguments_);
                const result = structuredResult(value);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result };
            }
            catch (error) {
                options.onError?.(tool.id, error);
                const message = error instanceof Error ? error.message : String(error);
                return { isError: true, content: [{ type: 'text', text: message }] };
            }
        });
    }
    return server;
}
//# sourceMappingURL=server.js.map