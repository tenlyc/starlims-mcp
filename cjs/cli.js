#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const starlims_http_adapter_js_1 = require("./adapters/starlims-http-adapter.js");
const config_js_1 = require("./config.js");
const logger_js_1 = require("./logger.js");
const server_js_1 = require("./server.js");
const transports_js_1 = require("./transports.js");
const VERSION = '0.5.1';
async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${(0, config_js_1.configHelp)()}\n`);
        return;
    }
    if (argv.includes('--version') || argv.includes('-v')) {
        process.stdout.write(`${VERSION}\n`);
        return;
    }
    const config = await (0, config_js_1.loadStarlimsMcpConfig)(argv);
    const logger = (0, logger_js_1.createStderrLogger)({ debug: process.env.STARLIMS_MCP_DEBUG === '1', secrets: [config.password, config.authToken || ''] });
    const adapter = new starlims_http_adapter_js_1.StarlimsHttpAdapter(config, logger);
    await adapter.connect();
    const createServer = () => (0, server_js_1.createStarlimsMcpServer)({
        serverName: 'starlims-mcp',
        version: VERSION,
        profile: config.profile,
        adapter,
        instructions: `Use STARLIMS as the authoritative remote source. This server is running with the '${config.permissionPolicy}' policy. Browse or search before reading. Always carry an explicit language for multilingual form resources. Check out before saving and provide the version returned by the read tool.`,
        onError: (tool, error) => logger.error(`Tool '${tool}' failed.`, error)
    });
    if (config.transport === 'stdio') {
        await (0, transports_js_1.connectStdio)(createServer());
        logger.info(`Connected to STARLIMS as '${config.user}' using stdio transport (${config.permissionPolicy}).`);
        return;
    }
    const handle = await (0, transports_js_1.startHttpTransport)({ host: config.host, port: config.port, authToken: config.authToken, logger, createServer });
    logger.info(`HTTP transport listening at ${handle.url} (${config.permissionPolicy}).`);
    const shutdown = async () => {
        await handle.close();
        process.exitCode = 0;
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
}
main().catch((error) => {
    const logger = (0, logger_js_1.createStderrLogger)({ secrets: [process.env.STARLIMS_PASSWORD || '', process.env.STARLIMS_MCP_AUTH_TOKEN || ''] });
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map