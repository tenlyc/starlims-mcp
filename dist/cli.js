#!/usr/bin/env node
import { StarlimsHttpAdapter } from './adapters/starlims-http-adapter.js';
import { configHelp, loadStarlimsMcpConfig } from './config.js';
import { createStderrLogger } from './logger.js';
import { createStarlimsMcpServer } from './server.js';
import { connectStdio, startHttpTransport } from './transports.js';
const VERSION = '0.4.0';
async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${configHelp()}\n`);
        return;
    }
    if (argv.includes('--version') || argv.includes('-v')) {
        process.stdout.write(`${VERSION}\n`);
        return;
    }
    const config = await loadStarlimsMcpConfig(argv);
    const logger = createStderrLogger({ debug: process.env.STARLIMS_MCP_DEBUG === '1', secrets: [config.password, config.authToken || ''] });
    const adapter = new StarlimsHttpAdapter(config, logger);
    await adapter.connect();
    const createServer = () => createStarlimsMcpServer({
        serverName: 'starlims-mcp',
        version: VERSION,
        profile: config.profile,
        adapter,
        instructions: `Use STARLIMS as the authoritative remote source. This server is running with the '${config.permissionPolicy}' policy. Browse or search before reading. Always carry an explicit language for multilingual form resources. Check out before saving and provide the version returned by the read tool.`,
        onError: (tool, error) => logger.error(`Tool '${tool}' failed.`, error)
    });
    if (config.transport === 'stdio') {
        await connectStdio(createServer());
        logger.info(`Connected to STARLIMS as '${config.user}' using stdio transport (${config.permissionPolicy}).`);
        return;
    }
    const handle = await startHttpTransport({ host: config.host, port: config.port, authToken: config.authToken, logger, createServer });
    logger.info(`HTTP transport listening at ${handle.url} (${config.permissionPolicy}).`);
    const shutdown = async () => {
        await handle.close();
        process.exitCode = 0;
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
}
main().catch((error) => {
    const logger = createStderrLogger({ secrets: [process.env.STARLIMS_PASSWORD || '', process.env.STARLIMS_MCP_AUTH_TOKEN || ''] });
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map