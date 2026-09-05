import { createStarlimsMcpServer } from './server.js';
import { createStderrLogger } from './logger.js';
import { startHttpTransport } from './transports.js';
import type { BackendComponentVersion, StarlimsMcpAdapter } from './types.js';

declare const __STARLIMS_MCP_VERSION__: string;

const bridgeUrl = String(process.env.STARLIMS_DEVTOOLS_BRIDGE_URL || '');
const bridgeToken = String(process.env.STARLIMS_DEVTOOLS_BRIDGE_TOKEN || '');
const host = String(process.env.STARLIMS_MCP_HOST || '127.0.0.1');
const port = Number(process.env.STARLIMS_MCP_PORT || 3102);
const capabilities = JSON.parse(String(process.env.STARLIMS_MCP_CAPABILITIES || '[]')) as string[];
const backend = JSON.parse(String(process.env.STARLIMS_MCP_BACKEND_COMPONENTS || '[]')) as BackendComponentVersion[];
const logger = createStderrLogger({ debug: process.env.STARLIMS_MCP_DEBUG === '1', secrets: [bridgeToken] });

async function main(): Promise<void> {
  if (!bridgeUrl || !bridgeToken || !Array.isArray(capabilities) || !capabilities.length) throw new Error('The DevTools bridge configuration is invalid.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('The MCP port is invalid.');
  const adapter: StarlimsMcpAdapter = {
    id: 'starlims-devtools-bridge',
    confirmsDatabaseChanges: true,
    capabilities,
    invoke: async (tool, arguments_) => {
      const response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${bridgeToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ tool, arguments: arguments_ })
      });
      const payload = await response.json() as { result?: unknown; error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error || `DevTools bridge returned HTTP ${response.status}.`);
      return payload.result;
    },
    backendComponents: () => backend
  };
  const createServer = () => createStarlimsMcpServer({
    serverName: 'starlims-devtools',
    version: __STARLIMS_MCP_VERSION__,
    profile: 'devtools',
    adapter,
    onError: (tool, error) => logger.error(`STARLIMS MCP tool '${tool}' failed.`, error)
  });
  const handle = await startHttpTransport({ host, port, logger, createServer });
  logger.info(`Shared STARLIMS MCP server ${__STARLIMS_MCP_VERSION__} listening at ${handle.url}`);
  const shutdown = async () => { await handle.close(); process.exit(0); };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void main().catch((error) => {
  logger.error('Shared STARLIMS MCP process failed to start.', error);
  process.exitCode = 2;
});
