# STARLIMS MCP

Connect AI applications to STARLIMS to read and edit code, forms and multilingual resources.

**starlims-mcp owns the shared MCP interfaces. STARLIMS DevTools integrates them and provides the development UI.**

[Download v0.5.2](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.5.2) · [DevTools downloads](https://github.com/tenlyc/starlims-devtools/releases) · [Tool catalog](docs/TOOLS.md) · [简体中文](README.md)

## Use through DevTools

Recommended for everyday page development, table editing, menus and runtime previews.

1. Install [STARLIMS DevTools](https://github.com/tenlyc/starlims-devtools/releases).
2. Deploy the matching `SCM_API.sdp` to STARLIMS, or reuse a compatible installation.
3. Open DevTools, sign in to STARLIMS and use its built-in AI agent.

DevTools starts the shared MCP service automatically. Other AI applications can connect to `http://127.0.0.1:3102/mcp` while DevTools remains running and signed in.

## Run independently

Standalone mode connects directly to STARLIMS without the DevTools desktop app. It requires Node.js 22.12 or later, STARLIMS credentials and a compatible SCM_API deployment. It supports stdio and HTTP.

See the [standalone guide](docs/STANDALONE.md) for installation and connection settings.

| Mode in v0.5.2 | Tools, including discovery | Available work |
| --- | ---: | --- |
| DevTools | 37 | Page development, tables, resources, menus and previews |
| Standalone, default read-only | 8 | Browse, search, read code, resources and table definitions |
| Standalone, writes enabled | 13 | Also check out, save, edit resources and check in |

Standalone mode does not yet implement all desktop capabilities. Ask the AI to call `get_capabilities` to see what the current connection supports. Actual operations remain subject to STARLIMS permissions; successful saves require separate runtime verification.

## Server package

`SCM_API.sdp` is imported into STARLIMS so MCP can access the system. This repository maintains and releases it; DevTools distributes the identical package.

The [release](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.5.2) includes the SDP, its checksum and provenance manifest. The `starlims-mcp-devtools-server.cjs` file and checksum are used for DevTools MCP service updates. Updating that service does not automatically import an SDP.

## More documentation

- [Generated tool catalog](docs/TOOLS.md)
- [Tool usage and multilingual resources](docs/TOOL_GUIDE.md)
- [Standalone setup](docs/STANDALONE.md)
- [Development, integration and provenance](docs/DEVELOPMENT.md)

## License

This is an unofficial community project, not affiliated with or supported by STARLIMS Corporation. Some capabilities reference the MIT-licensed [MrDoe/starlimsvscode](https://github.com/MrDoe/starlimsvscode). See [MIT License](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
