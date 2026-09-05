# 开发、集成与来源说明

日常使用请先看 [首页](../README.md)；接口列表见 [TOOLS.md](TOOLS.md)。

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
   ├── standalone HTTP   direct SCM_API calls, read-only/write policy
   ├── starlims-devtools   Electron session, approvals, write gates
   ├── starlimsvscode      VS Code workspace compatibility
   └── future tools        CLI, web, test runner, other STARLIMS products
             │
             ▼
one merged SCM_API namespace (upstream base + starlims-mcp `Mcp*` extensions)
```

嵌入模式下由宿主负责登录凭据、服务器选择、权限确认和实际 API 调用；独立模式使用本仓库提供的 HTTP Adapter，并从环境变量或本地配置读取连接信息。无论哪种模式，只有 Adapter 声明支持且服务端权限策略允许的能力才会注册为 MCP 工具。

In embedded mode the host owns credentials, server selection, approval UX, and API calls. Standalone mode uses the HTTP adapter provided here and loads connection settings from environment variables or local configuration. In both modes, only capabilities declared by the adapter and permitted by the server policy are registered as MCP tools.


## 单一 SCM_API 部署包 / Single SCM_API deployment package

| Namespace | 中文策略 | English policy |
| --- | --- | --- |
| `SCM_API.*` | 唯一部署命名空间：保留固定上游基础脚本，自有扩展通常使用 `Mcp*` 前缀，菜单使用 `MenuManagement` | The only deployment namespace: preserves the pinned upstream base while owned extensions normally use an `Mcp*` prefix; menus use `MenuManagement` |

来源归属仍独立记录：普通上游脚本归属 `starlimsvscode`，`McpGetSCMUsers`、`McpGetCheckInHistory`、`McpExportPackage`、`McpImportPackage` 等自有脚本归属 `starlims-mcp`。本仓库从 `scm/server` 构建统一的 `SCM_API.sdp`，DevTools 构建时校验并复制同一发布包，不再提供第二个产品专属 SDP。

Provenance remains separate: regular upstream scripts belong to `starlimsvscode`, while owned scripts such as `McpGetSCMUsers`, `McpGetCheckInHistory`, `McpExportPackage`, and `McpImportPackage` belong to `starlims-mcp`. This repository builds one `SCM_API.sdp` from `scm/server`; DevTools verifies and copies that same distribution and no longer ships a second product-specific SDP.

不要在 Vendor 快照中直接修改代码。自有 MCP 契约进入 `src/`，当前后端源码进入 `scm/server`，`scm/extensions/SCM_API` 保留历史来源策略；宿主 UI 和 Adapter 留在对应产品仓库。

Do not edit Vendor snapshots directly. Owned MCP contracts belong in `src/`, maintained backend sources belong in `scm/server` (`scm/extensions/SCM_API` retains historical provenance policy), and host UI/Adapter code remains in the relevant product repository.

## Vendor 快照 / Vendor snapshots

当前索引见 [`vendor/index.json`](../vendor/index.json)。每个版本目录包含：

See [`vendor/index.json`](../vendor/index.json) for the current index. Every snapshot directory contains:

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


### 作为库嵌入 / Embedded library

```ts
import { createStarlimsMcpServer } from '@tenlyc/starlims-mcp';

const server = createStarlimsMcpServer({
  version: '0.6.0',
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

### DevTools 联机验收

DevTools 1.7.0 Beta 6 与共享包 0.5.2 已完成 37 工具握手、只读远端调用和中文页面预览验收。独立 HTTP Adapter 的能力范围与桌面宿主不同。

```bash
# 在已启动并登录的 starlims-devtools 仓库中执行
npm run test:mcp-live
```

`npm run check` 会构建 ESM/CommonJS、执行契约测试，并离线校验全部 Vendor 快照。

`npm run check` builds ESM/CommonJS outputs, runs contract tests, and verifies every Vendor snapshot offline.

Vendor 文本摘要会先将 CRLF 规范化为 LF，二进制文件保持原始字节，因此同一快照可在 macOS、Windows 和 Linux CI 中得到一致结果。只有重新审查或导入快照时才应运行 `npm run vendor:refresh`。

Vendor text digests canonicalize CRLF to LF while binary files retain their original bytes, producing identical snapshot verification on macOS, Windows, and Linux CI. Run `npm run vendor:refresh` only when a snapshot has been re-reviewed or imported.


## 渲染端导入

Electron 渲染端或浏览器通过 `@tenlyc/starlims-mcp/browser` 导入 Schema 和工作流，通过 `@tenlyc/starlims-mcp/client` 导入共享服务器执行适配器、菜单服务与表定义验证。两个子入口均不依赖 Node 服务模块。根入口包含 Node 服务端模块，用于主进程或独立服务。

## Profile 和执行适配

Profile 指一组接口定义；Adapter 指实际执行这些接口的代码。DevTools 的接口定义和注册统一由本仓库管理，DevTools 提供登录会话、编辑器、预览和权限门禁。工具是否可用取决于当前适配实现和权限策略，以 `get_capabilities` 为准。

每个工具的 `origin` 表示来源：`starlimsvscode` 为源自或兼容上游的能力，`starlims-mcp` 为本仓库维护的自有能力。`provenance` 记录维护仓库、许可、来源关系及固定提交；DevTools 是执行宿主，不是第三种代码来源。

来源与版权声明见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

## 共享服务器执行层（v0.6.0）

`StarlimsHttpAdapter` 直接实现服务器侧工具。菜单规划与核对位于 `src/menu-service.ts`，表定义语义验证位于 `src/table-definition.ts`，两者由根入口导出供 Node 宿主复用。源自 DevTools 的这两部分不再需要 Electron、渲染进程全局 DOM 或编辑器状态。

独立与 DevTools 的契约保持兼容，当前独立允许写入时提供 29 个工具；DevTools 39 个中的另外 10 个仍需浏览器/编辑器宿主。`npm run test` 中有精确集合比较，防止未来新增服务器工具时遗漏独立适配。DevTools 1.7.0 Beta 7 通过 `./client` 复用该执行层，并注入已有 Electron HTTP 传输；宿主继续负责会话、逐次审批、质量门禁、编辑器变更通知及预览。DevTools 原生多用户日志面板行为保持不变。

宿主集成时，每个独立账号/环境应新建 Adapter；不得跨账号复用含菜单计划的实例。配置在构造时复制并冻结。适配器在直接 `invoke` 时也检查权限、profile、能力与工具 schema，不能通过绕过 MCP 注册层调用只读策略下的写工具。
