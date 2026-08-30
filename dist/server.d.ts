import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StarlimsMcpAdapter, StarlimsMcpProfile } from './types.js';
export interface CreateStarlimsMcpServerOptions {
    version: string;
    adapter: StarlimsMcpAdapter;
    profile?: StarlimsMcpProfile;
    serverName?: string;
    instructions?: string;
    onError?: (tool: string, error: unknown) => void;
}
export declare function createStarlimsMcpServer(options: CreateStarlimsMcpServerOptions): McpServer;
//# sourceMappingURL=server.d.ts.map