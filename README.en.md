# STARLIMS MCP

Connect AI applications to STARLIMS to read and edit code, forms and multilingual resources.

**starlims-mcp owns the shared MCP interfaces. STARLIMS DevTools integrates them and provides the development UI.**

[Download v0.6.0](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.6.0) · [DevTools downloads](https://github.com/tenlyc/starlims-devtools/releases) · [Tool catalog](docs/TOOLS.md) · [简体中文](README.md)

## Use through DevTools

Recommended for everyday page development, table editing, menus and runtime previews.

1. Install [STARLIMS DevTools](https://github.com/tenlyc/starlims-devtools/releases).
2. Deploy the matching `SCM_API.sdp` to STARLIMS, or reuse a compatible installation.
3. Open DevTools, sign in to STARLIMS and use its built-in AI agent.

DevTools starts the shared MCP service automatically. Other AI applications can connect to `http://127.0.0.1:3102/mcp` while DevTools remains running and signed in.

## Run independently

Standalone mode connects directly to STARLIMS without the DevTools desktop app. It requires Node.js 22.12 or later, STARLIMS credentials and a compatible SCM_API deployment. It supports stdio and HTTP.

See the [standalone guide](docs/STANDALONE.md) for installation and connection settings.

| Mode in v0.6.0 | Tools, including discovery | Available work |
| --- | ---: | --- |
| DevTools | 39 | Page development, tables, resources, menus and previews |
| Standalone, default read-only | 14 | Code, resources, tables, logs, checkout/history, menu planning and database queries |
| Standalone, writes enabled | 29 | Also maintain objects/tables, execute scripts/data sources, create menus and approve database changes |

**v0.6.0 provides 14 read-only tools or 29 with writes enabled (including discovery, default `unified` profile).** Logs, checkout/history, object and table maintenance, script/data-source execution, and menu configuration connect directly to SCM_API without DevTools. DevTools 1.7.0 Beta 7 reuses the same server execution implementation.

The remaining 10 tools need a host: preview/browser inspection, SSL validation, editor diagnostics and DevTools output. Arbitrary script/data-source execution requires `allow-writes`. Database tools require the matching backend scripts. See the [standalone capability matrix](docs/STANDALONE.md). `get_capabilities` lists registered adapter support; backend compatibility and account permissions require actual calls. Successful saves still require separate runtime verification.

## Server package

`SCM_API.sdp` is imported into STARLIMS so MCP can access the system. This repository maintains and releases it; DevTools distributes the identical package.

The [release](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.6.0) includes the SDP, its checksum and provenance manifest. The `starlims-mcp-devtools-server.cjs` file and checksum are used for DevTools MCP service updates. Updating that service does not automatically import an SDP.

## More documentation

- [Generated tool catalog](docs/TOOLS.md)
- [Tool usage and multilingual resources](docs/TOOL_GUIDE.md)
- [Standalone setup](docs/STANDALONE.md)
- [Development, integration and provenance](docs/DEVELOPMENT.md)

## License

This is an unofficial community project, not affiliated with or supported by STARLIMS Corporation. Some capabilities reference the MIT-licensed [MrDoe/starlimsvscode](https://github.com/MrDoe/starlimsvscode). See [MIT License](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).

v0.6.0 adds [database queries and per-call approved changes](docs/DATABASE_ACCESS.md) using the existing STARLIMS Database connection.
