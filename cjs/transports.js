"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MCP_JSON_BODY_LIMIT = void 0;
exports.connectStdio = connectStdio;
exports.startHttpTransport = startHttpTransport;
const node_crypto_1 = require("node:crypto");
const express_1 = __importDefault(require("express"));
const hostHeaderValidation_js_1 = require("@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
async function connectStdio(server) {
    await server.connect(new stdio_js_1.StdioServerTransport());
}
exports.DEFAULT_MCP_JSON_BODY_LIMIT = '8mb';
async function startHttpTransport(options) {
    // The MCP SDK helper uses Express' default 100 KB JSON parser. STARLIMS
    // forms and scripts commonly exceed that size, so configure an explicit,
    // bounded limit before any MCP route is registered.
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: options.jsonBodyLimit ?? exports.DEFAULT_MCP_JSON_BODY_LIMIT }));
    if (['127.0.0.1', 'localhost', '::1'].includes(options.host)) {
        app.use((0, hostHeaderValidation_js_1.localhostHostValidation)());
    }
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
            if (sessionId || !(0, types_js_1.isInitializeRequest)(request.body)) {
                response.status(sessionId ? 404 : 400).json({ jsonrpc: '2.0', error: { code: -32001, message: sessionId ? 'Unknown MCP session.' : 'Initialize an MCP session first.' }, id: null });
                return;
            }
            const server = options.createServer();
            let transport;
            transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
                enableJsonResponse: true,
                sessionIdGenerator: () => (0, node_crypto_1.randomUUID)(),
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