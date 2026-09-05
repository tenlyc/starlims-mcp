import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { STARLIMS_MCP_INSTRUCTIONS } from './instructions.js';
import { buildCapabilityDocument } from './capabilities.js';
import { getProfileTools } from './catalog.js';
const annotationsFor = (risk) => ({
    readOnlyHint: risk === 'read',
    destructiveHint: risk === 'destructive',
    idempotentHint: risk === 'read',
    openWorldHint: risk === 'execute'
});
const structuredResult = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value))
        return { ok: true, ...value };
    return { ok: true, data: value };
};
export function createStarlimsMcpServer(options) {
    const profile = options.profile || 'unified';
    const serverName = options.serverName || 'starlims-mcp';
    const server = new McpServer({ name: serverName, version: options.version }, {
        capabilities: { logging: {}, tools: {} },
        instructions: options.instructions || STARLIMS_MCP_INSTRUCTIONS
    });
    server.registerTool('get_capabilities', {
        title: 'Get STARLIMS MCP capabilities',
        description: 'Describe active tools, origins, risk levels, adapter capabilities, and backend component versions.',
        inputSchema: z.object({}),
        annotations: annotationsFor('read')
    }, async () => {
        const document = await buildCapabilityDocument({ serverName, version: options.version, profile, adapter: options.adapter });
        return { content: [{ type: 'text', text: JSON.stringify(document, null, 2) }], structuredContent: document };
    });
    for (const tool of getProfileTools(profile, options.adapter.capabilities)) {
        server.registerTool(tool.id, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: annotationsFor(tool.risk)
        }, async (rawArguments) => {
            const arguments_ = (rawArguments || {});
            try {
                const value = await options.adapter.invoke(tool.adapterTool || tool.id, arguments_);
                if (tool.id === 'capture_form_screenshot' && value && typeof value === 'object' && 'imageData' in value && typeof value.imageData === 'string') {
                    const { imageData, mimeType, ...metadata } = value;
                    const result = structuredResult(metadata);
                    return { content: [{ type: 'image', data: String(imageData), mimeType: String(mimeType || 'image/png') }, { type: 'text', text: JSON.stringify(result) }], structuredContent: result };
                }
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