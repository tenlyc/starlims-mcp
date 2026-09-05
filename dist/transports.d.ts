import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StarlimsLogger } from './logger.js';
export declare function connectStdio(server: McpServer): Promise<void>;
export interface HttpTransportHandle {
    url: string;
    close(): Promise<void>;
}
export declare const DEFAULT_MCP_JSON_BODY_LIMIT = "8mb";
export declare function startHttpTransport(options: {
    host: string;
    port: number;
    authToken?: string;
    jsonBodyLimit?: string | number;
    logger: StarlimsLogger;
    createServer: () => McpServer;
}): Promise<HttpTransportHandle>;
//# sourceMappingURL=transports.d.ts.map