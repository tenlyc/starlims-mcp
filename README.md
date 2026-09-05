# STARLIMS MCP

面向 STARLIMS 开发工具的共享 MCP 契约、宿主无关运行时，以及可离线验证的 MCP/SCM 源码快照。

Shared MCP contracts and a host-neutral runtime for STARLIMS development tools, plus offline-verifiable MCP/SCM source snapshots.

> 本项目是非官方社区项目，与 STARLIMS Corporation 无隶属或支持关系。
>
> This is an unofficial community project and is not affiliated with or supported by STARLIMS Corporation.

## 仓库定位 / Repository role

本仓库不是简单的上游链接集合。它实际保存并发布：

This repository is not merely a collection of upstream links. It stores and publishes:

- `src/`：由本仓库维护的统一工具目录、Zod Schema、来源/风险元数据、能力握手和 Server 工厂。

  `src/`: the maintained unified tool catalog, Zod schemas, provenance/risk metadata, capability handshake, and server factory.
- `dist/` 与 `cjs/`：可直接使用的 ESM、CommonJS 和 TypeScript 类型产物。

  `dist/` and `cjs/`: ready-to-use ESM, CommonJS, and TypeScript declaration artifacts.
- `vendor/`：固定提交的 `starlimsvscode` 与 `starlims-devtools` MCP/SCM 源码快照，包含逐文件 SHA-256。

  `vendor/`: commit-pinned MCP/SCM source snapshots from `starlimsvscode` and `starlims-devtools`, with per-file SHA-256 hashes.
- `scm/`：共享后端扩展命名空间、来源清单和兼容策略。

  `scm/`: shared backend-extension namespaces, provenance manifests, and compatibility policy.

因此，即使来源仓库以后删除、私有化或无法访问，已保存版本仍可从本仓库恢复和验证。Vendor 文件保留原始来源与许可证，不代表本仓库取得上游项目所有权。

As a result, preserved versions remain recoverable and verifiable even if a source repository is later deleted, made private, or becomes unavailable. Vendored files retain their original provenance and license; vendoring does not claim ownership of the upstream project.

## 架构 / Architecture

```text
AI client
   │ MCP
   ▼
@tenlyc/starlims-mcp       shared contracts, schemas, risks, capabilities
   │ Adapter
   ├── starlims-devtools   Electron session, approvals, write gates
   ├── starlimsvscode      VS Code workspace compatibility
   └── future tools        CLI, web, test runner, other STARLIMS products
             │
             ▼
one merged SCM_API namespace (upstream base + starlims-mcp `Mcp*` extensions)
```

嵌入模式下由宿主负责登录凭据、服务器选择、权限确认和实际 API 调用；独立模式使用本仓库提供的 HTTP Adapter，并从环境变量或本地配置读取连接信息。无论哪种模式，只有 Adapter 声明支持且服务端权限策略允许的能力才会注册为 MCP 工具。

In embedded mode the host owns credentials, server selection, approval UX, and API calls. Standalone mode uses the HTTP adapter provided here and loads connection settings from environment variables or local configuration. In both modes, only capabilities declared by the adapter and permitted by the server policy are registered as MCP tools.

## Profile 与工具来源 / Profiles and tool provenance

### 给其他应用单独使用时 / Standalone use from another application

其他 AI 应用连接独立 starlims-mcp 时，不需要启动 DevTools 桌面程序，但 STARLIMS 服务器必须部署兼容的 SCM_API 接口。当前完整配套部署包由本仓库 Releases 和 npm 包内 `scm/distribution/SCM_API.sdp` 交付，校验值及来源记录一起提供。`scm/server` 是当前维护源码，`scm/extensions` 是历史扩展布局。已经在同一 STARLIMS 环境部署兼容版本时，不要重复导入；升级时按服务器变更流程部署匹配版本。接口包不包含 DevTools 的桌面预览、菜单 Adapter 或登录会话。

Other applications can use standalone starlims-mcp without running the DevTools desktop app. The STARLIMS server still needs a compatible SCM_API deployment. The complete `SCM_API.sdp`, checksum and provenance manifest are delivered by this repository's releases and npm package under scm/distribution. Maintained server sources live in scm/server. Reuse an existing compatible server deployment. Installing the server package does not add desktop-only adapter capabilities to standalone mode.

| Profile | 中文 | English |
| --- | --- | --- |
| `unified` | 面向新客户端的统一契约，按 Adapter 能力生成工具并集 | Unified contract for new clients, filtered by Adapter capabilities |
| `devtools` | 保持 DevTools 的 `uri + code + language` 写入契约 | Preserves the DevTools `uri + code + language` write contract |
| `vscode-compat` | 保留 VS Code 本地工作副本兼容接口 | Preserves VS Code local-working-copy compatibility |

每个工具都包含表示代码归属的 `origin`，值只保留两个：

Every tool declares an `origin`:

- `starlimsvscode`：源自或派生自 `MrDoe/starlimsvscode` 的基础能力 / foundational capabilities sourced or derived from `MrDoe/starlimsvscode`.
- `starlims-mcp`：由本仓库维护的全部自有能力，包括最初在 DevTools 中实现的能力 / all capabilities maintained here, including capabilities first implemented in DevTools.

宿主可用性由独立的 `profiles` 字段表达，因此 DevTools 只是 `devtools` Profile 和 Adapter，不是第三种工具来源。每个工具还包含机器可读的 `provenance`：

Host availability is expressed separately by `profiles`, so DevTools is a profile and Adapter rather than a third tool origin. Every tool also carries machine-readable `provenance` metadata:

- `repository`：实际来源或维护仓库 / source or maintaining repository.
- `owner`：维护方 / maintainer.
- `license`：来源许可证 / source license.
- `relationship`：`derived-from-upstream`（基于上游适配）、`upstream-compatible`（上游兼容）或 `original`（独立开发）。

  `relationship`: `derived-from-upstream`, `upstream-compatible`, or `original`.
- `sourceCommit`：引用上游时固定到已审查的 40 位提交 / reviewed 40-character upstream commit when applicable.

当前归属如下：

Current ownership is:

| 来源 / Source | 工具 / Tools | 说明 / Notes |
| --- | --- | --- |
| [`MrDoe/starlimsvscode`](https://github.com/MrDoe/starlimsvscode) | `browse_tree`, `search_by_name`, `global_code_search`, `list_languages`, `get_item_code`, `read_log`, `get_table_definition`, `checkout_item`, `save_item`, `checkin_item`, `undo_checkout`, `execute_server_script`, `execute_data_source`，以及 VS Code 兼容工具 | 基于固定上游提交适配为宿主无关契约；保留 MIT 来源与提交 / adapted from a pinned MIT-licensed upstream commit |
| [`tenlyc/starlims-mcp`](https://github.com/tenlyc/starlims-mcp) | `get_capabilities`, `get_form_resources`, `save_form_resources`, `set_form_resource`, `list_checked_out_items`, `query_checkin_history` | 本仓库维护的自有能力；后两项当前仅由 DevTools Profile/Adapter 提供 / capabilities maintained here; the last two are currently available through the DevTools profile/adapter |

工具实际执行时可调用 `get_capabilities` 查看每个已启用工具的完整来源，而不必依赖 README 的静态列表。

At runtime, call `get_capabilities` to inspect the complete provenance of every enabled tool instead of relying only on this static list.

连接后调用 `get_capabilities` 可读取实际工具、来源、风险、Schema 版本、Adapter 能力和后端组件版本。

Call `get_capabilities` after connecting to inspect active tools, provenance, risk, schema versions, Adapter capabilities, and backend component versions.

## MCP 接口目录 / MCP tool reference

### 0.5.2 同步说明 / Integration boundary

本版本同步 Resources 格式转换与标准运行绑定、经过状态核验的表单家族签入，以及重复签出保护。HTML/XFD 的 XML、CodeBehind、Resources、Guide 是一个签出家族，签出一次后直接读取和保存子项；重复签出可能覆盖工作副本，不能逐项再次签出。

This version includes resource format/binding fixes, verified family check-in, and preservation of an existing form checkout. XML, CodeBehind, Resources and Guide share one checkout. Do not re-checkout each child after editing.

DevTools Adapter 目前对外提供 37 个工具，包括菜单、预览、执行和表编辑。这 37 个接口的定义和协议注册现在全部属于本仓库；DevTools 只提供执行 Adapter 和登录会话，不再添加接口。独立 HTTP Adapter 尚未实现全部宿主执行能力。请用 get_capabilities 和 tools/list 核实当前连接。

The shared devtools profile defines all 37 tools exposed through the DevTools Adapter. Menu, preview, execution and table-editing capabilities depend on the DevTools adapter and session; they are not all implemented by the standalone HTTP adapter. Use get_capabilities and tools/list for the active connection.

验证：23 项测试、自动生成的接口文档和 3 个不可变 vendor 快照校验；共享 Server 的集成测试直接检查全部 37 个 DevTools 接口和截图响应。DevTools 实际材料类型中文页面、CRUD、菜单与系统打印验收属于宿主集成验证，不等于独立 HTTP Adapter 的全功能运行验收。

当前统一目录包含 **40 个业务工具**，Server 另外注册能力发现工具 `get_capabilities`。DevTools Profile 提供 **37 个工具**，其中所有接口均由本仓库统一定义和注册；完整可用目录见 [自动生成接口清单](docs/TOOLS.md)。实际客户端看到的数量由 `Profile ∩ Adapter capabilities ∩ permission policy` 决定，并不表示缺失的工具发生了故障。

The shared catalog contains **40 business tools** plus discovery. The DevTools profile exposes **37 tools**, all defined and registered here. See the [generated reference](docs/TOOLS.md). The actual list visible to a client is the intersection of the selected profile, Adapter capabilities, and permission policy; an omitted tool is not necessarily a server failure.

常见数量 / Common counts:

| 运行方式 / Runtime | 工具数量 / Tool count | 说明 / Notes |
| --- | ---: | --- |
| 独立 HTTP Adapter，`read-only` | 8 | 7 个读取工具 + `get_capabilities` / 7 read tools plus discovery |
| 独立 HTTP Adapter，`allow-writes` | 13 | 再增加签出、保存、Resources 写入和签入 / adds checkout, save, Resources writes, and check-in |
| STARLIMS DevTools Adapter | 37 | 36 个共享 Profile 工具 + `get_capabilities` / 36 shared profile tools plus discovery |
| 完整 `unified` Profile | 最多 40 | 39 个业务工具 + `get_capabilities`，仍受 Adapter 过滤 / 39 business tools plus discovery |
| 完整 `vscode-compat` Profile | 最多 26 | 25 个业务工具 + `get_capabilities` / 25 business tools plus discovery |

参数约定 / Parameter conventions:

- `uri` 是企业树、搜索或签出列表返回的 STARLIMS URI；不要根据名称自行拼接。

  `uri` is the authoritative STARLIMS URI returned by browse, search, or checkout tools; clients should not invent it from a display name.
- `language` 用于 HTML/XFD Form 的明确语言，例如 `CHS`、`ENG`。Resources 工具中该参数必填。

  `language` selects an explicit HTML/XFD Form language such as `CHS` or `ENG`; it is required for Resources tools.
- `maxItems`、`maxRows` 和 `maxCharacters` 用于限制上下文大小；返回结果会说明总量以及是否截断。

  `maxItems`, `maxRows`, and `maxCharacters` bound model context; responses report totals and truncation where applicable.
- `expectedVersion` 是读取结果返回的内容 SHA-256 指纹。写入时携带它可阻止覆盖已经变化的远端内容。

  `expectedVersion` is the content SHA-256 fingerprint returned by a read. Supplying it on a write prevents overwriting remote content that has changed.

### 能力发现 / Capability discovery

| 工具 / Tool | 参数 / Parameters | 风险 / Risk | 可用范围 / Availability | 说明 / Description |
| --- | --- | --- | --- | --- |
| `get_capabilities` | 无 / none | `read` | 所有 Server / every server | 返回 Server、Profile、Adapter、已启用 capability、工具来源/风险/Schema 和后端组件版本。Returns server, profile, Adapter, enabled capabilities, tool provenance/risk/schema, and backend component versions. |

### 通用读取工具 / Shared read tools

| 工具 / Tool | 主要参数 / Main parameters | Capability | 独立 Adapter / Standalone | 说明 / Description |
| --- | --- | --- | --- | --- |
| `browse_tree` | `uri?`, `maxItems?` | `items.browse` | ✅ | 浏览根目录或指定目录的企业树项目。Browse enterprise items from the root or below a folder URI. |
| `search_by_name` | `query`, `itemType?`, `exactMatch?`, `maxItems?` | `items.search` | ✅ | 按项目名称搜索，可限定类型和精确匹配。Search by item name with optional type and exact-match filters. |
| `global_code_search` | `searchString`, `itemTypes?`, `maxItems?` | `code.search` | ✅ | 跨 STARLIMS 代码项搜索文本。Search text across STARLIMS code items. |
| `list_languages` | `maxItems?` | `languages.list` | ✅ | 列出可用于表单的语言 ID 和名称。List available form language identifiers and names. |
| `get_item_code` | `uri`, `language?`, `maxCharacters?` | `code.read` | ✅ | 读取远端权威代码；写入前应先调用。Read authoritative remote code; call before editing. |
| `get_form_resources` | `uri`, `language`, `includeXml?`, `maxCharacters?` | `forms.resources.read` | ✅ | 读取指定语言的 Resources，返回版本指纹和结构化资源条目，可选返回完整 XML。Read one language, returning a version fingerprint, structured entries, and optional XML. |
| `read_log` | `user?`, `maxLines?` | `logs.read` | — | 读取 STARLIMS Server Log；当前由 DevTools/兼容宿主提供。Read the STARLIMS server log; currently host-provided. |
| `get_table_definition` | `uri`, `maxCharacters?` | `tables.read` | ✅ | 读取完整表定义 XML。Read a complete table-definition XML document. |

这些共享契约主要源自固定版本的 `MrDoe/starlimsvscode`；`get_form_resources` 是 `tenlyc/starlims-mcp` 原创能力。详细来源以 `get_capabilities.tools[].provenance` 为准。

Most shared contracts are derived from the pinned `MrDoe/starlimsvscode` source. `get_form_resources` is original to `tenlyc/starlims-mcp`. Use `get_capabilities.tools[].provenance` as the authoritative record.

### 通用写入与执行工具 / Shared write and execution tools

| 工具 / Tool | 主要参数 / Main parameters | 风险 / Risk | Capability | 独立 Adapter / Standalone | 说明 / Description |
| --- | --- | --- | --- | --- | --- |
| `checkout_item` | `uri`, `language?` | `write` | `checkout.write` | ✅ 写入模式 / write mode | 编辑前签出项目。Check out an item before editing. |
| `save_item` | `uri`, `code`, `language?`, `expectedVersion?` | `write` | `code.write` | ✅ 写入模式 / write mode | 保存完整代码，不是局部 Patch；支持版本冲突检查和写后回读。Save complete code, not a partial patch, with conflict detection and read-back verification. |
| `save_form_resources` | `uri`, `language`, `resourceXml`, `expectedVersion?` | `write` | `forms.resources.write` | ✅ 写入模式 / write mode | 批量保存指定语言的 Resources；服务器格式执行完整替换，设计器粘贴格式执行安全合并。保存结果会标明工作副本已更新、Designer 需要重新打开，以及运行时同步需要 Check In。Bulk-save one language; server format performs full replacement, while designer-paste format performs a safe merge. The result distinguishes working-copy update, Designer reload, and Check In required for runtime synchronization. |
| `set_form_resource` | `uri`, `language`, `resourceId`, `resourceValue`, `expectedVersion?` | `write` | `forms.resources.write` | ✅ 写入模式 / write mode | 按区分大小写的 ResourceId 新增或修改单个 ResourceValue，并保留其他资源；返回相同的 Designer/运行时状态提示。Create or update one ResourceValue by case-sensitive ResourceId while preserving all other entries, with the same Designer/runtime status guidance. |
| `checkin_item` | `uri`, `reason`, `language?` | `write` | `checkout.checkin` | ✅ 写入模式 / write mode | 用明确原因签入项目。Check in an item with an explicit reason. |
| `undo_checkout` | `uri` | `destructive` | `checkout.undo` | — | 撤销签出，可能丢失未保存内容，必须明确授权。Undo checkout; may discard work and requires explicit approval. |
| `execute_server_script` | `uri`, `parameters?`, `outputType?`, `entryPoint?`, `maxCharacters?` | `execute` | `scripts.execute` | — | 执行 Server Script 并返回受限输出。Execute a Server Script and return bounded output. |
| `execute_data_source` | `uri`, `parameters?`, `outputType?`, `maxRows?`, `maxCharacters?` | `execute` | `datasource.execute` | — | 执行 Data Source 并限制返回行数/字符数。Execute a Data Source with row and character limits. |

`—` 表示当前通用契约存在，但 v0.5.2 的独立 HTTP Adapter 尚未实现该能力；DevTools 或 VS Code Adapter 可以提供它。写入、执行和破坏性工具还必须经过宿主审批、服务器权限和质量门禁，不能只依据 MCP annotations 自动授权。

`—` means the unified contract exists but the v0.5.2 standalone HTTP Adapter does not implement that capability; a DevTools or VS Code Adapter may provide it. Write, execute, and destructive tools must also pass host approval, server authorization, and quality gates—MCP annotations alone are not authorization.

推荐远端编辑顺序 / Recommended remote-edit sequence:

```text
search_by_name or browse_tree
  → get_item_code / get_form_resources
  → checkout_item
  → save_item / set_form_resource / save_form_resources (with expectedVersion)
  → read again and verify
  → checkin_item only when the user explicitly requests it
```

### 当前由 DevTools Adapter 提供的自有工具 / MCP-owned tools currently provided by the DevTools Adapter

这些工具归属 `tenlyc/starlims-mcp`，当前只属于 `unified` 和 `devtools` Profile，并由 DevTools 当前登录会话实现。以后其他宿主实现相同 Capability 时可以直接复用契约。

These tools are owned by `tenlyc/starlims-mcp`, currently belong only to the `unified` and `devtools` profiles, and are implemented through the active DevTools session. Other hosts may reuse the same contracts after implementing the capabilities.

| 工具 / Tool | 参数 / Parameters | 风险 / Risk | Capability | 说明 / Description |
| --- | --- | --- | --- | --- |
| `list_checked_out_items` | `includeAllUsers?` | `read` | `checkout.list` | 列出当前用户或所有用户的签出项目。List checked-out items for the current user or all users. |
| `query_checkin_history` | `user`, `dateFrom`, `dateTo` | `read` | `scm.history` | 按用户和 `YYYY-MM-DD` 日期范围查询签入历史。Query check-in history by user and `YYYY-MM-DD` date range. |

### VS Code 兼容工具 / VS Code compatibility tools

这些工具来自或兼容 `MrDoe/starlimsvscode`，主要用于 `unified` 和 `vscode-compat` Profile。它们不会自动出现在 DevTools Profile，也没有全部由当前独立 HTTP Adapter 实现。

These tools originate from or preserve compatibility with `MrDoe/starlimsvscode`, primarily for the `unified` and `vscode-compat` profiles. They are not automatically exposed by the DevTools profile, and the current standalone HTTP Adapter does not implement all of them.

| 工具 / Tool | 参数 / Parameters | 风险 / Risk | Profile | 说明 / Description |
| --- | --- | --- | --- | --- |
| `refresh_checkout_tree` | `includeAllUsers?` | `write` | `unified`, `vscode-compat` | 刷新 VS Code 签出工作区镜像。Refresh the VS Code checked-out workspace mirror. |
| `vscode_save_local_item` | `localPath`, `language?` | `write` | `vscode-compat` | 按 VS Code 本地工作副本路径保存；Adapter 内映射到 `save_item`。Save by local working-copy path; mapped to `save_item` by the Adapter. |
| `create_item` | `itemName`, `itemType`, `language`, `categoryName`, `appName` | `write` | `unified`, `vscode-compat` | 创建企业树项目。Create an enterprise item. |
| `checkout_table` | `uri` | `write` | `unified`, `vscode-compat` | 签出表。Check out a table. |
| `checkin_table` | `uri`, `reason` | `write` | `unified`, `vscode-compat` | 签入表。Check in a table. |
| `create_table` | `tableName`, `dsn` | `write` | `unified`, `vscode-compat` | 创建数据库或字典表。Create a database or dictionary table. |
| `edit_table` | `uri`, `tableXml` | `write` | `unified`, `vscode-compat` | 保存完整表定义 XML。Save a complete table-definition XML document. |
| `run_integration_tests` | `reason?`, `maxCharacters?` | `execute` | `unified`, `vscode-compat` | 经明确授权运行宿主集成测试。Run host integration tests after explicit approval. |
| `transfer_item_to_server` | `targetServer`, `saveLocalEdits?` | `write` | `unified`, `vscode-compat` | 将签出项传输到另一台已配置服务器。Transfer checked-out items to another configured server. |

### 返回值与错误 / Results and errors

- 成功调用同时返回文本内容和 `structuredContent`，结构化结果包含 `ok: true`。

  Successful calls return both text content and `structuredContent`; structured results include `ok: true`.
- 工具失败返回 MCP `isError: true` 和可读错误信息，不应被客户端当作成功结果继续执行。

  Tool failures return MCP `isError: true` with a readable message and must not be treated as successful output.
- `get_capabilities` 是 Server 元工具，不属于 `STARLIMS_TOOL_CATALOG` 的 40 个业务契约，因此目录测试或 Profile 统计需要单独加 1。

  `get_capabilities` is a server-level meta tool rather than one of the 40 business contracts in `STARLIMS_TOOL_CATALOG`, so catalog/profile counts must add it separately.

### 多语言表单资源 / Multilingual form resources

共享契约提供三个显式携带 `language` 的工具：

The shared contract provides three tools that always carry an explicit `language`:

- `get_form_resources`：读取完整 Resources XML，并返回结构化的 `ResourceId`、`ResourceValue` 和 `Guid`。

  Reads the complete Resources XML and returns structured `ResourceId`, `ResourceValue`, and `Guid` entries.
- `set_form_resource`：只新增或修改一个资源值，保留文档中的其他资源。

  Creates or updates one resource value while preserving the rest of the document.
- `save_form_resources`：批量保存 Resources XML。输入 `ResourcesDataset/ResourcesTable` 时表示明确的完整替换；输入设计器粘贴格式 `<Resources><Resource><Id>…</Id><Value>…</Value></Resource></Resources>` 时，会转换为服务器格式并合并，保留已有 GUID 和 `GUIDE` 等仅存在于服务器的条目。

  Bulk-saves Resources XML. `ResourcesDataset/ResourcesTable` means an explicit full replacement. Designer-paste `<Resources><Resource><Id>…</Id><Value>…</Value></Resource></Resources>` input is converted and merged while preserving existing GUIDs and server-only entries such as `GUIDE`.

这些工具使用企业树或签出列表返回的 `/HTMLForms/Resources/...` URI。写入仍由宿主权限和内容版本门禁控制。

These tools use the `/HTMLForms/Resources/...` URI returned by browse or checkout operations. Writes remain subject to host approvals and content-version gates.

## 单一 SCM_API 部署包 / Single SCM_API deployment package

| Namespace | 中文策略 | English policy |
| --- | --- | --- |
| `SCM_API.*` | 唯一部署命名空间：保留固定上游基础脚本，自有扩展通常使用 `Mcp*` 前缀，菜单使用 `MenuManagement` | The only deployment namespace: preserves the pinned upstream base while owned extensions normally use an `Mcp*` prefix; menus use `MenuManagement` |

来源归属仍独立记录：普通上游脚本归属 `starlimsvscode`，`McpGetSCMUsers`、`McpGetCheckInHistory`、`McpExportPackage`、`McpImportPackage` 等自有脚本归属 `starlims-mcp`。本仓库从 `scm/server` 构建统一的 `SCM_API.sdp`，DevTools 构建时校验并复制同一发布包，不再提供第二个产品专属 SDP。

Provenance remains separate: regular upstream scripts belong to `starlimsvscode`, while owned scripts such as `McpGetSCMUsers`, `McpGetCheckInHistory`, `McpExportPackage`, and `McpImportPackage` belong to `starlims-mcp`. This repository builds one `SCM_API.sdp` from `scm/server`; DevTools verifies and copies that same distribution and no longer ships a second product-specific SDP.

不要在 Vendor 快照中直接修改代码。自有 MCP 契约进入 `src/`，当前后端源码进入 `scm/server`，`scm/extensions/SCM_API` 保留历史来源策略；宿主 UI 和 Adapter 留在对应产品仓库。

Do not edit Vendor snapshots directly. Owned MCP contracts belong in `src/`, maintained backend sources belong in `scm/server` (`scm/extensions/SCM_API` retains historical provenance policy), and host UI/Adapter code remains in the relevant product repository.

## Vendor 快照 / Vendor snapshots

当前索引见 [`vendor/index.json`](vendor/index.json)。每个版本目录包含：

See [`vendor/index.json`](vendor/index.json) for the current index. Every snapshot directory contains:

- `SNAPSHOT.json`：来源仓库、40 位提交、包含范围、许可证、文件数和整体摘要。

  `SNAPSHOT.json`: source repository, full commit, included scope, license, file count, and aggregate digest.
- `FILES.sha256`：除元数据外每个文件的 SHA-256。

  `FILES.sha256`: a SHA-256 entry for every preserved file except snapshot metadata.
- 实际 MCP/SCM 源码与 SDP，不使用 Git Submodule 或 Git LFS 外部指针。

  Actual MCP/SCM sources and SDP artifacts, without Git submodules or external Git LFS pointers.

离线验证 / Verify offline:

```bash
npm run vendor:verify
```

导入经过人工审查的新快照 / Import a reviewed snapshot:

```bash
node scripts/import-vendor-snapshot.mjs \
  --profile starlimsvscode \
  --source /path/to/clean/starlimsvscode \
  --commit <40-character-commit>

npm run vendor:index
npm run vendor:verify
```

导入工具要求来源仓库干净且 `HEAD` 与指定提交完全一致；不会联网，也不会静默覆盖已有快照。

The importer requires a clean source repository whose `HEAD` exactly matches the requested commit. It performs no network access and never silently overwrites an existing snapshot.

## 使用 / Usage

### 独立 Server / Standalone server

安装后可直接作为 MCP Server 启动，不依赖 starlims-devtools 或 VS Code：

After installation it can run as an MCP server without starlims-devtools or VS Code:

```bash
export STARLIMS_BASE_URL="https://starlims.example.com"
export STARLIMS_USER="developer"
export STARLIMS_PASSWORD="..."

npx -y @tenlyc/starlims-mcp --transport stdio
```

默认权限为 `read-only`，仅公开浏览、搜索、代码读取、语言、表定义和多语言 Resources 读取。明确允许写入后才注册签出、保存、签入和 Resources 写入工具：

The default policy is `read-only`. Checkout, save, check-in, and Resources write tools are registered only when writes are explicitly enabled:

```bash
npx -y @tenlyc/starlims-mcp \
  --transport stdio \
  --permission-policy allow-writes
```

可使用 JSON 配置文件保存非敏感设置：

Non-secret settings may be stored in a JSON config file:

```json
{
  "baseUrl": "https://starlims.example.com",
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
starlims-mcp --config ./starlims-mcp.json
```

密码、Token、Cookie 和 Authorization 值会从日志中脱敏。建议只通过环境变量或宿主密钥存储提供密码，不要提交包含明文密码的配置文件。

Passwords, tokens, cookies, and authorization values are redacted from logs. Supply passwords through environment variables or host secret storage, and never commit plaintext credentials.

Streamable HTTP 模式默认绑定本机回环地址：

Streamable HTTP mode binds to loopback by default:

```bash
starlims-mcp --transport http --host 127.0.0.1 --port 3102
```

绑定到非回环地址时必须提供至少 16 字符的 `STARLIMS_MCP_AUTH_TOKEN`。客户端通过 `Authorization: Bearer <token>` 访问 `/mcp`。

Binding to a non-loopback address requires `STARLIMS_MCP_AUTH_TOKEN` with at least 16 characters. Clients authenticate to `/mcp` with `Authorization: Bearer <token>`.

### 作为库嵌入 / Embedded library

```ts
import { createStarlimsMcpServer } from '@tenlyc/starlims-mcp';

const server = createStarlimsMcpServer({
  version: '0.5.2',
  profile: 'devtools',
  adapter: {
    id: 'my-starlims-host',
    capabilities: ['items.browse', 'code.read', 'code.write'],
    invoke: (tool, args) => callHost(tool, args)
  }
});
```

只有 Adapter 声明的能力会被公开。核心运行时不保存 STARLIMS 密码；独立 Adapter 只在进程内持有启动时提供的凭据。

Only Adapter-declared capabilities are exposed. The core runtime stores no STARLIMS passwords; the standalone adapter keeps startup credentials in process memory only.

## 开发与验证 / Development and verification

```bash
npm install
npm run check
npm pack --dry-run
```

生成供 STARLIMS DevTools 运行时更新使用的独立 Server 发布资产：

Build the standalone Server release assets used by STARLIMS DevTools runtime updates:

```bash
npm run build:devtools-server
```

该命令生成 `release-assets/starlims-mcp-devtools-server.cjs` 及对应 SHA-256 文件。推送
版本标签后，Release 工作流会发布这两个文件。STARLIMS DevTools 只有在资产齐全且摘要
校验一致时才安装更新；否则继续使用随程序提供的版本和内置回退服务。

The command creates `release-assets/starlims-mcp-devtools-server.cjs` and its SHA-256 file.
The tag release workflow publishes both assets. STARLIMS DevTools installs an update only when
both are present and the digest matches; otherwise it retains the bundled version and embedded
fallback.

### DevTools 宿主联机验收 / Live DevTools host verification

STARLIMS DevTools v1.6.2 已使用本组件 v0.5.x 完成验收，并在应用启动、登录后提供只读联机验收命令：

STARLIMS DevTools v1.6.2 has been validated against this component's v0.5.x line and provides a read-only live acceptance command after the application is running and signed in:

```bash
# 在 starlims-devtools 仓库中执行 / run in the starlims-devtools repository
npm run test:mcp-live
```

该测试通过真实 `starlims-devtools-bridge` Adapter 验证 MCP 握手、`get_capabilities`、当时的 19 个工具（当前 devtools Profile 为 37 个）、两个来源以及单一 `SCM_API` 后端，并实际读取企业树、检出项和签入历史。输出只包含数量，不打印 STARLIMS 名称、代码、地址或账号。

The test uses the real `starlims-devtools-bridge` Adapter to verify the MCP handshake, `get_capabilities`, the 19 tools exposed at that time (the current devtools profile has 37), both provenance origins, and the single `SCM_API` backend. It also reads the enterprise tree, checked-out items, and check-in history. Output contains counts only and does not print STARLIMS names, code, addresses, or accounts.

`npm run check` 会构建 ESM/CommonJS、执行契约测试，并离线校验全部 Vendor 快照。

`npm run check` builds ESM/CommonJS outputs, runs contract tests, and verifies every Vendor snapshot offline.

Vendor 文本摘要会先将 CRLF 规范化为 LF，二进制文件保持原始字节，因此同一快照可在 macOS、Windows 和 Linux CI 中得到一致结果。只有重新审查或导入快照时才应运行 `npm run vendor:refresh`。

Vendor text digests canonicalize CRLF to LF while binary files retain their original bytes, producing identical snapshot verification on macOS, Windows, and Linux CI. Run `npm run vendor:refresh` only when a snapshot has been re-reviewed or imported.

## 来源与许可 / Provenance and license

共享契约和兼容映射参考了 MIT 授权的 [`MrDoe/starlimsvscode`](https://github.com/MrDoe/starlimsvscode)。具体来源、提交和版权声明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 与各快照中的许可证。

The shared contracts and compatibility mappings reference MIT-licensed behavior from [`MrDoe/starlimsvscode`](https://github.com/MrDoe/starlimsvscode). See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and each snapshot's preserved license for exact provenance, commits, and copyright notices.

本仓库自身代码采用 [MIT License](LICENSE)。

This repository's own code is licensed under the [MIT License](LICENSE).

For HTML Forms, resource writes also verify and repair the standard `Resources` loading binding in Form XML, using the GUID resolved from the exact enterprise URI and the explicit language. Existing layered fallback remains intact; custom data sources require manual review. `formBindingVerified` and `formBindingUpdated` report this separately from runtime synchronization. Resources and Form XML use two version-checked saves, not a transaction; re-read both after any partial failure. No automatic check-in is performed.

Resources tools return `formDiagnostics` (binding status, enterprise/XML GUID mismatch, and column definitions missing `xtype`) and `runtimeVerified: false`. These are read-only structural checks, not runtime acceptance. `get_form_resources` additionally returns the resource data `format`. A Form's `<Resources><Data>...</Data></Resources>` is a loading binding, not designer-paste resource data; supplying it to `save_form_resources` is rejected rather than interpreted as zero rows. Resource rows missing their value element are also rejected; explicit empty values remain supported. Build new Form XML from a Designer-generated template for the same control types, preserving typed column metadata.

Browser renderers import schemas/workflows from `@tenlyc/starlims-mcp/browser`; the root entry includes Node server modules and belongs in the host process. The browser entry is tested with a browser-target bundle.
