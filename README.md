# STARLIMS MCP

共享的 STARLIMS MCP 工具契约和宿主无关运行时，用于汇总并区分
`starlimsvscode`、`starlims-devtools` 与独立 MCP 后续发展的能力。

> This is an unofficial community project and is not affiliated with or
> supported by STARLIMS Corporation.

## 设计目标

- 一个统一工具目录，明确每个工具的来源、风险、能力与 Schema 版本。
- `unified`、`devtools`、`vscode-compat` 三种 Profile，避免同名工具参数冲突。
- Adapter 隔离 VS Code、Electron 和未来独立进程的产品运行时。
- `get_capabilities` 握手公开实际可用工具和 STARLIMS 后端组件版本。
- 上游 `SCM_API`、公共 `STARLIMS_MCP_API` 和产品专属
  `STARLIMS_DEVTOOLS_API` 分开维护。

## 当前边界

本仓库不保存 STARLIMS 密码，也不直接选择登录服务器。宿主通过
`StarlimsMcpAdapter` 提供实际能力：

```ts
import { createStarlimsMcpServer } from '@tenlyc/starlims-mcp';

const server = createStarlimsMcpServer({
  version: '0.1.0',
  profile: 'devtools',
  adapter: {
    id: 'starlims-devtools',
    capabilities: ['items.browse', 'code.read', 'code.write'],
    invoke: (tool, args) => callHost(tool, args)
  }
});
```

只有 Adapter 声明支持的能力才会注册为 MCP 工具。

## Profile

| Profile | 用途 |
| --- | --- |
| `unified` | 面向新客户端的统一契约；按 Adapter 能力生成两边工具的并集。 |
| `devtools` | 保持 STARLIMS DevTools 现有 `uri + code + language` 写入契约。 |
| `vscode-compat` | 保留 starlimsvscode 的兼容工具，包括基于本地路径的 `vscode_save_local_item`。 |

## SCM 命名空间

| 组件 | 维护方 | 策略 |
| --- | --- | --- |
| `SCM_API.*` | MrDoe/starlimsvscode 上游 | 固定来源提交和校验值；不在本仓库直接修改。 |
| `STARLIMS_MCP_API.*` | starlims-mcp | 多个 MCP 宿主可共享的后端扩展。 |
| `STARLIMS_DEVTOOLS_API.*` | starlims-devtools | 只服务 DevTools UI、工作区或质量门禁的产品接口。 |

来源和兼容信息见 [`scm/manifests`](scm/manifests) 与
[`compatibility`](compatibility)。

## 开发

```bash
npm install
npm run check
```

## 来源与许可

工具行为和兼容映射参考了 MIT 授权的
[`MrDoe/starlimsvscode`](https://github.com/MrDoe/starlimsvscode)。本仓库不会
自动覆盖上游源码，具体声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
