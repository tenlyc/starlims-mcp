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
SCM_API / STARLIMS_MCP_API / product-specific backend extensions
```

嵌入模式下由宿主负责登录凭据、服务器选择、权限确认和实际 API 调用；独立模式使用本仓库提供的 HTTP Adapter，并从环境变量或本地配置读取连接信息。无论哪种模式，只有 Adapter 声明支持且服务端权限策略允许的能力才会注册为 MCP 工具。

In embedded mode the host owns credentials, server selection, approval UX, and API calls. Standalone mode uses the HTTP adapter provided here and loads connection settings from environment variables or local configuration. In both modes, only capabilities declared by the adapter and permitted by the server policy are registered as MCP tools.

## Profile 与工具来源 / Profiles and tool provenance

| Profile | 中文 | English |
| --- | --- | --- |
| `unified` | 面向新客户端的统一契约，按 Adapter 能力生成工具并集 | Unified contract for new clients, filtered by Adapter capabilities |
| `devtools` | 保持 DevTools 的 `uri + code + language` 写入契约 | Preserves the DevTools `uri + code + language` write contract |
| `vscode-compat` | 保留 VS Code 本地工作副本兼容接口 | Preserves VS Code local-working-copy compatibility |

每个工具都包含 `origin`：

Every tool declares an `origin`:

- `shared`：多个宿主共同采用的稳定契约 / stable contracts shared by multiple hosts.
- `starlimsvscode`：VS Code 专属兼容能力 / VS Code-specific compatibility behavior.
- `starlims-devtools`：DevTools 产品专属能力 / DevTools product-specific behavior.
- `starlims-mcp`：本仓库独立发展的公共能力 / public capabilities developed by this repository.

`origin` 只表示工具面向哪些宿主或兼容 Profile，不再被用来推断代码所有权。每个工具还包含机器可读的 `provenance`：

`origin` only describes host/profile availability and must not be used to infer code ownership. Every tool also carries machine-readable `provenance` metadata:

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
| [`tenlyc/starlims-mcp`](https://github.com/tenlyc/starlims-mcp) | `get_capabilities`, `get_form_resources`, `save_form_resources`, `set_form_resource` | 本仓库独立开发的共享能力 / original shared capabilities maintained here |
| [`tenlyc/starlims-devtools`](https://github.com/tenlyc/starlims-devtools) | `list_checked_out_items`, `query_checkin_history` | DevTools 原创产品能力，经统一 Profile 暴露 / original DevTools capabilities exposed through the unified profile |

工具实际执行时可调用 `get_capabilities` 查看每个已启用工具的完整来源，而不必依赖 README 的静态列表。

At runtime, call `get_capabilities` to inspect the complete provenance of every enabled tool instead of relying only on this static list.

连接后调用 `get_capabilities` 可读取实际工具、来源、风险、Schema 版本、Adapter 能力和后端组件版本。

Call `get_capabilities` after connecting to inspect active tools, provenance, risk, schema versions, Adapter capabilities, and backend component versions.

### 多语言表单资源 / Multilingual form resources

共享契约提供三个显式携带 `language` 的工具：

The shared contract provides three tools that always carry an explicit `language`:

- `get_form_resources`：读取完整 Resources XML，并返回结构化的 `ResourceId`、`ResourceValue` 和 `Guid`。

  Reads the complete Resources XML and returns structured `ResourceId`, `ResourceValue`, and `Guid` entries.
- `set_form_resource`：只新增或修改一个资源值，保留文档中的其他资源。

  Creates or updates one resource value while preserving the rest of the document.
- `save_form_resources`：保存经过调用方编辑的完整 Resources XML，适用于批量修改。

  Saves a complete caller-edited Resources XML document for bulk changes.

这些工具使用企业树或签出列表返回的 `/HTMLForms/Resources/...` URI。写入仍由宿主权限和内容版本门禁控制。

These tools use the `/HTMLForms/Resources/...` URI returned by browse or checkout operations. Writes remain subject to host approvals and content-version gates.

## SCM 命名空间 / SCM namespaces

| Namespace | 中文策略 | English policy |
| --- | --- | --- |
| `SCM_API.*` | 来源于 `MrDoe/starlimsvscode`；固定提交并原样保存 | Sourced from `MrDoe/starlimsvscode`; commit-pinned and preserved unchanged |
| `STARLIMS_MCP_API.*` | 多个 MCP 宿主共享的新后端扩展 | New backend extensions shared by multiple MCP hosts |
| `STARLIMS_DEVTOOLS_API.*` | DevTools UI、工作区或质量门禁专属扩展 | Extensions specific to DevTools UI, workspace, or quality gates |

不要在 Vendor 快照中直接修改代码。共享修改进入 `src/` 或 `scm/extensions/STARLIMS_MCP_API`，产品修改留在对应产品仓库。

Do not edit Vendor snapshots directly. Shared changes belong in `src/` or `scm/extensions/STARLIMS_MCP_API`; product changes remain in the relevant product repository.

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
  version: '0.4.0',
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

`npm run check` 会构建 ESM/CommonJS、执行契约测试，并离线校验全部 Vendor 快照。

`npm run check` builds ESM/CommonJS outputs, runs contract tests, and verifies every Vendor snapshot offline.

## 来源与许可 / Provenance and license

共享契约和兼容映射参考了 MIT 授权的 [`MrDoe/starlimsvscode`](https://github.com/MrDoe/starlimsvscode)。具体来源、提交和版权声明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 与各快照中的许可证。

The shared contracts and compatibility mappings reference MIT-licensed behavior from [`MrDoe/starlimsvscode`](https://github.com/MrDoe/starlimsvscode). See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and each snapshot's preserved license for exact provenance, commits, and copyright notices.

本仓库自身代码采用 [MIT License](LICENSE)。

This repository's own code is licensed under the [MIT License](LICENSE).
