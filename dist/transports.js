import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
export async function connectStdio(server) {
    await server.connect(new StdioServerTransport());
}
export async function startHttpTransport(options) {
    const app = createMcpExpressApp({ host: options.host });
    const sessions = new Map();
    app.get('/health', (_request, response) => response.json({ ok: true, service: 'starlims-mcp' }));
    app.all('/mcp', async (request, response) => {
        if (options.authToken && request.header('authorization') !== `Bearer ${options.authToken}`) {
            response.status(401).json({ jsonrpc: '2.0', error: { code: -32002, message: 'Unauthorized' }, id: null });
            return;
        }
        const sessionId = request.header('mcp-session-id');
        let session = sessionId ? sessions.get(sessionId) : undefined;
        if (!session) {
            if (sessionId || !isInitializeRequest(request.body)) {
                response.status(sessionId ? 404 : 400).json({ jsonrpc: '2.0', error: { code: -32001, message: sessionId ? 'Unknown MCP session.' : 'Initialize an MCP session first.' }, id: null });
                return;
            }
            const server = options.createServer();
            let transport;
            transport = new StreamableHTTPServerTransport({
                enableJsonResponse: true,
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => { sessions.set(id, { server, transport }); },
                onsessionclosed: (id) => {
                    sessions.delete(id);
                    void server.close();
                }
            });
            await server.connect(transport);
            session = { server, transport };
        }
        try {
            await session.transport.handleRequest(request, response, request.body);
        }
        catch (error) {
            options.logger.error('MCP HTTP request failed.', error);
            if (!response.headersSent)
                response.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal MCP server error.' }, id: null });
        }
    });
    const httpServer = await new Promise((resolve, reject) => {
        const candidate = app.listen(options.port, options.host, () => resolve(candidate));
        candidate.once('error', reject);
    });
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : options.port;
    const url = `http://${options.host}:${port}/mcp`;
    return {
        url,
        close: async () => {
            await Promise.allSettled([...sessions.values()].map(({ server }) => server.close()));
            sessions.clear();
            await new Promise((resolve) => httpServer.close(() => resolve()));
        }
    };
}
//# sourceMappingURL=transports.js.map