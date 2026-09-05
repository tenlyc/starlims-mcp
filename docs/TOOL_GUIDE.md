# 接口使用说明

完整工具列表和适用范围由源码生成，见 [TOOLS.md](TOOLS.md)。本页补充参数、编辑顺序与 Resources 行为。

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


For HTML Forms, resource writes also verify and repair the standard `Resources` loading binding in Form XML, using the GUID resolved from the exact enterprise URI and the explicit language. Existing layered fallback remains intact; custom data sources require manual review. `formBindingVerified` and `formBindingUpdated` report this separately from runtime synchronization. Resources and Form XML use two version-checked saves, not a transaction; re-read both after any partial failure. No automatic check-in is performed.

Resources tools return `formDiagnostics` (binding status, enterprise/XML GUID mismatch, and column definitions missing `xtype`) and `runtimeVerified: false`. These are read-only structural checks, not runtime acceptance. `get_form_resources` additionally returns the resource data `format`. A Form's `<Resources><Data>...</Data></Resources>` is a loading binding, not designer-paste resource data; supplying it to `save_form_resources` is rejected rather than interpreted as zero rows. Resource rows missing their value element are also rejected; explicit empty values remain supported. Build new Form XML from a Designer-generated template for the same control types, preserving typed column metadata.


[返回首页](../README.md)
