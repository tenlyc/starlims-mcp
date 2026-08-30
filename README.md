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

宿主负责登录凭据、服务器选择、权限确认和实际 API 调用。只有 Adapter 声明支持的能力才会注册为 MCP 工具。

The host owns credentials, server selection, approval UX, and actual API calls. Only capabilities declared by the Adapter are registered as MCP tools.

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

```ts
import { createStarlimsMcpServer } from '@tenlyc/starlims-mcp';

const server = createStarlimsMcpServer({
  version: '0.3.1',
  profile: 'devtools',
  adapter: {
    id: 'my-starlims-host',
    capabilities: ['items.browse', 'code.read', 'code.write'],
    invoke: (tool, args) => callHost(tool, args)
  }
});
```

只有 Adapter 声明的能力会被公开。共享运行时不保存 STARLIMS 密码，也不自行选择服务器。

Only Adapter-declared capabilities are exposed. The shared runtime stores no STARLIMS passwords and does not select a server by itself.

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
