# Changelog

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
