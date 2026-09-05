# 独立运行 starlims-mcp

安装后可直接作为 MCP Server 启动，不依赖 starlims-devtools 或 VS Code：

After installation it can run as an MCP server without starlims-devtools or VS Code:

先安装 Node.js 22.12 或更新版本，再从已发布的 Git 标签获取代码：

```bash
git clone --branch v0.5.2 --depth 1 https://github.com/tenlyc/starlims-mcp.git
cd starlims-mcp
npm ci
```

以下命令在该目录中执行。STARLIMS 环境需先部署 [SCM_API.sdp](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.5.2)；已有兼容版本可复用。`STARLIMS_BASE_URL` 填服务器环境地址，包含应用路径，例如 `https://server.example.com/LKK_NEW`。

```bash
export STARLIMS_BASE_URL="https://server.example.com/LKK_NEW"
export STARLIMS_USER="developer"
export STARLIMS_PASSWORD="..."

node dist/cli.js --transport stdio
```

默认权限为 `read-only`，仅公开浏览、搜索、代码读取、语言、表定义和多语言 Resources 读取。明确允许写入后才注册签出、保存、签入和 Resources 写入工具：

The default policy is `read-only`. Checkout, save, check-in, and Resources write tools are registered only when writes are explicitly enabled:

```bash
node dist/cli.js \
  --transport stdio \
  --permission-policy allow-writes
```

可使用 JSON 配置文件保存非敏感设置：

Non-secret settings may be stored in a JSON config file:

```json
{
  "baseUrl": "https://server.example.com/LKK_NEW",
  "user": "developer",
  "passwordEnv": "STARLIMS_PASSWORD",
  "urlSuffix": "lims",
  "language": "CHS",
  "profile": "unified",
  "transport": "stdio",
  "permissionPolicy": "read-only"
}
```

```bash
node dist/cli.js --config ./starlims-mcp.json
```

密码、Token、Cookie 和 Authorization 值会从日志中脱敏。建议只通过环境变量或宿主密钥存储提供密码，不要提交包含明文密码的配置文件。

Passwords, tokens, cookies, and authorization values are redacted from logs. Supply passwords through environment variables or host secret storage, and never commit plaintext credentials.

Streamable HTTP 模式默认绑定本机回环地址：

Streamable HTTP mode binds to loopback by default:

```bash
node dist/cli.js --transport http --host 127.0.0.1 --port 3102
```

绑定到非回环地址时必须提供至少 16 字符的 `STARLIMS_MCP_AUTH_TOKEN`。客户端通过 `Authorization: Bearer <token>` 访问 `/mcp`。

Binding to a non-loopback address requires `STARLIMS_MCP_AUTH_TOKEN` with at least 16 characters. Clients authenticate to `/mcp` with `Authorization: Bearer <token>`.


## 接入 AI 应用

- **stdio**：由 AI 应用启动进程。配置命令为 `node`，参数为 `/绝对路径/starlims-mcp/dist/cli.js`、`--transport`、`stdio`，并在该应用的 MCP 环境变量设置中填写连接信息。命令行中的 `export` 仅适用于 macOS/Linux；Windows 可通过客户端环境变量配置。
- **HTTP**：先运行上面的 HTTP 启动命令，再在 AI 应用中添加 `http://127.0.0.1:3102/mcp`。同机已有 DevTools 占用 3102 时，用 `--port 3103` 并相应修改客户端地址。

默认提供 8 个只读工具；启用 `allow-writes` 后为 13 个。菜单、建表、桌面预览等完整开发流程请通过 DevTools 使用。连接后可让 AI 调用 `get_capabilities` 查看当前可用工具。

[返回首页](../README.md)
