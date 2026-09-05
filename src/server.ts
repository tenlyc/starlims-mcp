import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { STARLIMS_MCP_INSTRUCTIONS } from './instructions.js';
import { buildCapabilityDocument } from './capabilities.js';
import { getProfileTools } from './catalog.js';
import type { StarlimsMcpAdapter, StarlimsMcpProfile, StarlimsToolRisk } from './types.js';

export interface CreateStarlimsMcpServerOptions {
  version: string;
  adapter: StarlimsMcpAdapter;
  profile?: StarlimsMcpProfile;
  serverName?: string;
  instructions?: string;
  onError?: (tool: string, error: unknown) => void;
}

const annotationsFor = (risk: StarlimsToolRisk) => ({
  readOnlyHint: risk === 'read',
  destructiveHint: risk === 'destructive',
  idempotentHint: risk === 'read',
  openWorldHint: risk === 'execute'
});

const structuredResult = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ok: true, ...(value as Record<string, unknown>) };
  return { ok: true, data: value };
};

export function createStarlimsMcpServer(options: CreateStarlimsMcpServerOptions): McpServer {
  const profile = options.profile || 'unified';
  const serverName = options.serverName || 'starlims-mcp';
  const server = new McpServer(
    { name: serverName, version: options.version },
    {
      capabilities: { logging: {}, tools: {} },
      instructions: options.instructions || STARLIMS_MCP_INSTRUCTIONS
    }
  );

  server.registerTool(
    'get_capabilities',
    {
      title: 'Get STARLIMS MCP capabilities',
      description: 'Describe active tools, origins, risk levels, adapter capabilities, and backend component versions.',
      inputSchema: z.object({}),
      annotations: annotationsFor('read')
    },
    async () => {
      const document = await buildCapabilityDocument({ serverName, version: options.version, profile, adapter: options.adapter });
      return { content: [{ type: 'text' as const, text: JSON.stringify(document, null, 2) }], structuredContent: document as unknown as Record<string, unknown> };
    }
  );

  for (const tool of getProfileTools(profile, options.adapter.capabilities)) {
    server.registerTool(
      tool.id,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: annotationsFor(tool.risk)
      },
      async (rawArguments: unknown) => {
        const arguments_ = (rawArguments || {}) as Record<string, unknown>;
        try {
          const value = await options.adapter.invoke(tool.adapterTool || tool.id, arguments_);
          if (tool.id === 'capture_form_screenshot' && value && typeof value === 'object' && 'imageData' in value && typeof value.imageData === 'string') {
            const { imageData, mimeType, ...metadata } = value as Record<string, unknown>;
            const result = structuredResult(metadata);
            return { content: [{ type: 'image' as const, data: String(imageData), mimeType: String(mimeType || 'image/png') }, { type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
          }
          const result = structuredResult(value);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        } catch (error) {
          options.onError?.(tool.id, error);
          const message = error instanceof Error ? error.message : String(error);
          return { isError: true, content: [{ type: 'text' as const, text: message }] };
        }
      }
    );
  }

  return server;
}
