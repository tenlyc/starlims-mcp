import { randomUUID } from 'node:crypto';
import type { Server as NodeHttpServer } from 'node:http';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { StarlimsLogger } from './logger.js';

export async function connectStdio(server: McpServer): Promise<void> {
  await server.connect(new StdioServerTransport());
}

export interface HttpTransportHandle {
  url: string;
  close(): Promise<void>;
}

type HttpRequest = { body: unknown; header(name: string): string | undefined };
type HttpResponse = {
  headersSent: boolean;
  status(code: number): HttpResponse;
  json(value: unknown): HttpResponse;
};

export async function startHttpTransport(options: {
  host: string;
  port: number;
  authToken?: string;
  logger: StarlimsLogger;
  createServer: () => McpServer;
}): Promise<HttpTransportHandle> {
  const app = createMcpExpressApp({ host: options.host });
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  app.get('/health', (_request: HttpRequest, response: HttpResponse) => response.json({ ok: true, service: 'starlims-mcp' }));
  app.all('/mcp', async (request: HttpRequest, response: HttpResponse) => {
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
      let transport!: StreamableHTTPServerTransport;
      transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id): void => { sessions.set(id, { server, transport }); },
        onsessionclosed: (id) => {
          sessions.delete(id);
          void server.close();
        }
      });
      await server.connect(transport);
      session = { server, transport };
    }
    try {
      await session.transport.handleRequest(request as never, response as never, request.body);
    } catch (error) {
      options.logger.error('MCP HTTP request failed.', error);
      if (!response.headersSent) response.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal MCP server error.' }, id: null });
    }
  });

  const httpServer = await new Promise<NodeHttpServer>((resolve, reject) => {
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
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  };
}
