# 独立运行 starlims-mcp

安装后可直接作为 MCP Server 启动，不依赖 starlims-devtools 或 VS Code：

After installation it can run as an MCP server without starlims-devtools or VS Code:

先安装 Node.js 22.12 或更新版本，再从已发布的 Git 标签获取代码：

```bash
git clone --branch v0.6.0 --depth 1 https://github.com/tenlyc/starlims-mcp.git
cd starlims-mcp
npm ci
```

以下命令在该目录中执行。STARLIMS 环境需先部署 [SCM_API.sdp](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.6.0)；已有兼容版本可复用。`STARLIMS_BASE_URL` 填服务器环境地址，包含应用路径，例如 `https://server.example.com/LKK_NEW`。

```bash
export STARLIMS_BASE_URL="https://server.example.com/LKK_NEW"
export STARLIMS_USER="developer"
export STARLIMS_PASSWORD="..."

node dist/cli.js --transport stdio
```

默认权限为 `read-only`。v0.6.0 提供 14 个只读工具，完整能力见下表。开启 `allow-writes` 后才注册写入和任意脚本/数据源执行工具：

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

v0.6.0 默认提供 14 个只读工具，启用 `allow-writes` 后为 29 个。

## 独立能力

默认 `unified` profile：只读 **14** 个、允许写入 **29** 个，均包含 `get_capabilities`。stdio 和 HTTP 使用相同的适配器与权限策略。`--profile devtools` 只是选择契约集合，不会给独立进程增加浏览器或编辑器。

| 模式 | 工具 | 实际服务器接口 |
| --- | --- | --- |
| 只读 | `get_capabilities` | 本地能力及后端版本信息 |
| 只读 | `browse_tree` | `GetEnterpriseItems` |
| 只读 | `search_by_name` / `global_code_search` | `Search` / `GlobalSearch` |
| 只读 | `list_languages` | `GetLanguages` |
| 只读 | `get_item_code` / `get_form_resources` | `GetCode` |
| 只读 | `get_table_definition` | `TableGetById` |
| 只读 | `read_log` | `GetCode`，URI 为 `/ServerLogs/<user>.log` |
| 只读 | `list_checked_out_items` | `GetCheckedOutItems` |
| 只读 | `query_checkin_history` | `RunScript` → `McpGetCheckInHistory` |
| 只读 | `get_menu_configuration` / `plan_menu_item` | 固定 Console 数据源、`MenuManagement.ResolveForm`、表单及语言读取 |
| 只读 | `query_database` | `McpQueryDatabase`，需配套新脚本 |
| 允许写入 | `checkout_item` / `checkout_table` | `CheckOut` |
| 允许写入 | `save_item` / `save_form_resources` / `set_form_resource` | `SaveCode`，并回读验证 |
| 允许写入 | `checkin_item` / `checkin_table` | `CheckIn`，并验证签出状态释放 |
| 允许写入 | `undo_checkout` | `UndoCheckOut`，并验证签出状态释放 |
| 允许写入 | `create_item` | `Add` |
| 允许写入 | `create_table` / `edit_table` | `TableAdd` / `TableSave`，并回读验证 |
| 允许写入 | `execute_server_script` / `execute_data_source` | `RunScript` |
| 允许写入 | `apply_menu_item` | `MenuManagement.CreateItem`，并核对菜单、标题与角色 |
| 允许写入，逐次人工确认 | `execute_database_change` | `McpExecuteDatabaseChange`，需配套新脚本及客户端 form elicitation |

`read_log` 默认当前账号、最近 500 行，最多返回 10000 行 / 1000000 字符，并标记截断。服务器当前仍返回完整日志，因此该限制不等于服务器读取或网络传输上限。空日志和无日志文件返回 `empty: true`；无权限、HTTP 错误及不符合契约的响应返回错误，不伪装成空日志。用 `browse_tree` 的 `/ServerLogs` 目录查看日志条目。

签出列表保留原始 XML 行字段，并提供 `guid`、`name`、`type`、`checkedOutBy`、`checkedOutDate` 和 `language`；缺失语言返回 null，不使用登录语言代替签出证据。

表编辑必须提供完整 `TableDTO`、最近一次读取的 `expectedVersion`，并保留目标表 Id。保存要求当前用户已签出，检查版本后保存，再语义比较字段、类型、长度、标题、索引和关系。版本检查是客户端提交前检查，SCM_API.TableSave 尚未提供服务端原子 compare-and-swap，仍存在并发修改窗口。保存不会自动签入。

菜单规划仅支持在现有 HTML 分组中新增条目。先展示具体计划，获得用户对分组、标题、参数及角色的确认后再调用 `apply_menu_item`。计划在进程内保存 15 分钟；重启后需重新规划；失败或结果未知时不自动重试。

任意脚本与数据源可能改变数据，所以即使只返回查询结果，也不在默认只读模式开放。只读菜单/历史工具仅调用内置固定查询路径，不公开通用执行入口。`maxRows` / `maxCharacters` 限制返回内容，不限制业务执行工作量。数据库逐次确认规则见 [DATABASE_ACCESS.md](DATABASE_ACCESS.md)。

独立注册范围不代表目标服务器的对应端点已部署或当前用户获准调用；缺少接口会直接报错，不回退为签出并修改临时数据源。

## 仍需宿主的能力

- 浏览器：`open_form_preview`、`refresh_form_preview`、`set_preview_viewport`、`capture_form_screenshot`、`inspect_form_element`、`get_preview_console_errors`、`get_preview_load_errors`。
- 编辑器/LSP：`validate_ssl`、`get_editor_diagnostics`。
- 宿主输出：`get_devtools_output`。

这 10 个工具当前由 DevTools 宿主实现。VS Code 的本地镜像、文件保存、集成测试与跨服务器传送等兼容工具也没有在独立适配器中声明。

## 验证边界

自动测试覆盖 SCM_API 契约、只读拒绝、日志解析、菜单规划/应用、表保存与签出状态验证，以及外部客户端的 stdio / Streamable HTTP 调用。服务器响应由测试夹具提供，不代表生产或测试 STARLIMS 已完成真实运行验收。

[返回首页](../README.md)
