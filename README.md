# STARLIMS MCP

让 AI 通过 MCP 读取和修改 STARLIMS 中的代码、表单和资源，协助完成页面开发。

**starlims-mcp 统一管理 MCP 接口，DevTools 集成这些接口，提供可视化开发界面。**

[下载 v0.6.0](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.6.0) · [DevTools 下载](https://github.com/tenlyc/starlims-devtools/releases) · [接口清单](docs/TOOLS.md) · [English](README.en.md)

## 能做什么？

通过 DevTools 使用时，可以让 AI：

- 查找项目、读取脚本、搜索代码和查看日志。
- 签出、修改、保存和签入代码或表单。
- 创建和修改表定义，执行脚本与数据源。
- 维护中文等多语言页面资源。
- 预览页面、检查控件、截图和读取运行错误。
- 为页面配置菜单名称、参数和允许访问的角色。

例如，你可以对 AI 说：

> 参考现有材料类型页面，新建一个测试页面。完成后检查中文显示，再向我确认要放到哪个菜单、允许哪些角色访问。

AI 的操作仍受 STARLIMS 账号权限和当前工具能力限制。保存成功后，还需要打开实际页面验证。

## 怎么使用？

### 方式一：通过 DevTools 使用（推荐）

适合日常开发、建表、设计页面、调试和菜单配置。

1. 安装 [STARLIMS DevTools](https://github.com/tenlyc/starlims-devtools/releases)。
2. 在 STARLIMS 环境中部署配套的 `SCM_API.sdp`，已有兼容版本可直接使用。
3. 打开 DevTools，登录 STARLIMS，使用内置 AI 代理。

DevTools 会自动启动 starlims-mcp，通常不需要单独安装本项目。

如果想让其他 AI 应用使用同一套开发能力，保持 DevTools 运行并登录，在该 AI 应用中添加 HTTP MCP 地址：

```text
http://127.0.0.1:3102/mcp
```

### 方式二：独立运行

适合已有 MCP 客户端，希望直接连接 STARLIMS、无需打开 DevTools 的用户。

需要 Node.js 22.12 或更新版本、STARLIMS 账号，以及已部署的 `SCM_API.sdp`。支持 stdio 和 HTTP 两种连接方式。

安装命令、连接配置及客户端接入步骤见 [独立运行指南](docs/STANDALONE.md)。

### 两种方式有什么区别？

以下是 v0.6.0 的能力范围，数量包含能力查询接口：

| 使用方式 | 可用工具 | 适合做什么 |
| --- | ---: | --- |
| 通过 DevTools | 39 个 | 页面开发、建表、资源、菜单和运行预览 |
| 独立运行，默认只读 | 14 个 | 浏览、搜索、代码、资源、表定义、日志、签出历史、菜单规划和数据库查询 |
| 独立运行，开启写入 | 29 个 | 增加对象与表维护、签出/保存/签入、脚本和数据源执行、菜单创建及数据库修改 |

**v0.6.0 已补齐服务器侧独立适配：默认只读 14 个工具，开启写入后 29 个（含能力查询，默认 `unified` profile）。** 日志、签出列表与历史、对象创建、表维护、脚本/数据源执行和菜单配置均可直接调用 SCM_API，无需启动 DevTools。DevTools 1.7.0 Beta 7 也复用同一服务器执行实现。

预览、截图、DOM 检查、页面错误、SSL 校验、编辑器诊断及 DevTools 输出日志这 10 个工具仍由宿主提供；默认只读不会开放任意脚本/数据源执行。数据库新接口另需配套后台脚本，具体见[独立能力清单](docs/STANDALONE.md#独立能力)。`get_capabilities` 表示当前适配器注册的能力，目标服务器接口版本和权限仍需实际调用确认。

## SCM_API.sdp 是什么？

它是安装到 **STARLIMS 服务器**中的接口包，让 MCP 能够读取和操作 STARLIMS。

```text
AI 应用 → starlims-mcp → SCM_API → STARLIMS
```

本仓库统一维护接口源码和 `SCM_API.sdp`，DevTools 分发相同的服务包。在 [Release 下载页](https://github.com/tenlyc/starlims-mcp/releases/tag/v0.6.0) 中：

| 文件 | 用途 |
| --- | --- |
| `SCM_API.sdp` | 导入 STARLIMS 的服务包 |
| `SCM_API.sdp.sha256`、`manifest.json` | 服务包校验和来源信息 |
| `starlims-mcp-devtools-server.cjs` 及其 `.sha256` | DevTools 更新共享 MCP 服务时使用 |

同一环境已有兼容的 SCM_API 时，无需因连接另一个 AI 应用再次导入。更新 MCP 服务也不会自动更新 STARLIMS 中的 SDP。

## 更多说明

- [完整接口清单](docs/TOOLS.md)：工具名称及适用范围，由源码自动生成。
- [接口使用说明](docs/TOOL_GUIDE.md)：参数、编辑顺序、多语言资源和错误处理。
- [独立运行指南](docs/STANDALONE.md)：安装、配置和接入 AI 应用。
- [开发与集成说明](docs/DEVELOPMENT.md)：架构、构建、执行适配和来源快照。

## 来源与许可

本项目为非官方社区项目，与 STARLIMS Corporation 无隶属或支持关系。

部分能力参考 MIT 授权的 [MrDoe/starlimsvscode](https://github.com/MrDoe/starlimsvscode)。本项目采用 [MIT License](LICENSE)，第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

v0.6.0 新增[数据库查询与逐次确认修改](docs/DATABASE_ACCESS.md)，直接复用 STARLIMS Database 连接。
