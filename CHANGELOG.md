# Changelog

## [Unreleased]

- 增加完整的中英文 MCP 接口目录，说明参数、风险、Capability、Profile、来源、独立 Adapter 支持情况、工具数量和推荐操作流程。

## [0.4.0] - 2026-08-30

- 增加可执行 CLI、stdio 与 Streamable HTTP 传输，支持脱离宿主独立运行。
- 增加独立 STARLIMS HTTP Adapter、环境变量/JSON 配置加载和日志敏感信息脱敏。
- 默认只读；显式允许后提供签出、保存、签入、多语言 Resources 写入、内容版本指纹和写后回读验证。
- `get_capabilities` 为 Server 和每个工具返回仓库、维护方、许可证、来源提交及派生关系。
- 增加模拟 SCM_API 的读取、写入、stdio 和 HTTP 端到端集成测试。
- npm 运行时包不再携带大型 Vendor 快照；快照仍完整保留在 GitHub 仓库并由 CI 验证。

## [0.3.1] - 2026-08-30

- 归档实现多语言 Form Resources MCP 的 DevTools 提交，包含资源解析、MIME/Base64 回退解码、写入门禁和测试。
- 扩展 DevTools 快照配置，确保独立恢复时包含完整的资源工具执行链。

## [0.3.0] - 2026-08-30

- 增加显式指定语言的 HTML/XFD Form Resources 结构化读取、完整 XML 保存和单资源更新契约。
- 契约保持宿主无关：DevTools 可立即实现，`starlimsvscode` 后续可接入相同能力。

## [0.2.0] - 2026-08-30

- 增加 `starlimsvscode` MCP/SCM_API 与 `starlims-devtools` MCP/SCM 的不可变源码快照。
- 增加逐文件 SHA-256、离线完整性校验和显式快照导入工具。
- README 改为完整中英文双语，并明确共享核心、Vendor 与产品 Adapter 的边界。

## [0.1.2] - 2026-08-30

- 将 ESM、CommonJS 和类型声明产物纳入 GitHub 标签，支持直接使用标签压缩包安装。

## [0.1.1] - 2026-08-30

- 同时发布 ESM 与 CommonJS 运行时入口，兼容 Electron、VS Code 和独立 Node 宿主。

## [0.1.0] - 2026-08-30

- 建立统一 STARLIMS MCP 工具目录和来源标记。
- 增加 `unified`、`devtools`、`vscode-compat` Profile。
- 增加宿主 Adapter 接口与 MCP Server 工厂。
- 增加 `get_capabilities` 能力与后端版本握手。
- 建立上游 SCM、公共扩展和 DevTools 扩展的独立命名空间。
