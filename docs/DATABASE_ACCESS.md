# 数据库查询与修改（v0.6.0）

无需 TENOSQL。两个 MCP 使用新建的自有 `SCM_API` 脚本，直接调用 STARLIMS 已配置的 `Database` 连接。没有读取、导出或返回密码，也不需要另填连接字符串。初版仅支持 SQL Server，不支持 Oracle。

## 查询

`query_database` 接受 `sql`、`parameters`、`maxRows`（默认 100，最多 1000）和 `timeoutSeconds`（默认 15，最多 30）。连接只允许 `Database`。

```json
{"sql":"SELECT ORDNO, TESTCODE FROM ORDTASK WHERE ORDNO = ?","parameters":["指定样品号"],"maxRows":100}
```

服务端再次校验受限 SELECT，拒绝多语句、注释、字符串字面量、SELECT INTO、CTE、锁提示、跨库名称、任意自定义函数等；字符串使用 `?` 绑定参数。部分合法复杂 SQL 也会被拒绝，不要自动绕过接口。结果包含列、行、行数、耗时和截断标记。实际查询使用 TOP 包裹派生表，因此表达式必须有列名，重复列名以及无 TOP 的内部 ORDER BY 可能报错。

查询复用现有连接，**不是新建的数据库只读账号**。只读限制来自服务端 SQL 校验；不应宣称数据库账户本身没有写权限。原有服务器接口访问控制仍需限制到获准的开发人员。

## 修改：每次确认

`execute_database_change` 只支持单条参数化 INSERT VALUES、UPDATE SET、DELETE。UPDATE/DELETE 必须是简单字段比较并用 AND 连接的 WHERE，不支持子查询、表达式、OR 或批量语句。建表和改表使用已有表定义 MCP。

```json
{"sql":"UPDATE ORDTASK SET STATUS = ? WHERE ORDNO = ? AND TESTCODE = ?","parameters":["指定状态","指定样品号","指定检测"],"maxAffectedRows":1,"reason":"用户确认的修正原因"}
```

- DevTools 显示完整 SQL、参数、原因、影响行数上限；即使是 Codex 或完全访问模式，也只允许本次确认，60 秒未确认自动拒绝。切换服务器或账号后原确认失效。
- 独立 MCP 使用客户端的 form elicitation，每次调用都确认。不支持这种交互的客户端不能执行此工具。模型传入 `approved: true` 无效。
- 在 Serializable 事务内先统计匹配行，超过确认上限则不执行写入；执行后再次检查影响行数，异常或超限回滚。上限默认 1、最多 100。
- 统计在确认之后、事务之内完成，不宣称展示了执行前的准确预计行数。触发器等数据库机制可能产生其他影响；仅统计匹配行并不等于业务验收。
- 不接入现有事务，结束时恢复原 SQL 超时。超时按每条命令生效，不是整个请求的总时限。
- 网络中断发生在提交之后时，结果可能未知，禁止自动重试，先查询实际数据。这个版本没有持久化幂等键。

确认由 MCP/DevTools 边界强制执行，直接调用后台 HTTP 的受信任管理员仍受 STARLIMS 自身接口权限约束。部署时必须限制三个后台脚本的调用与编辑权限；MCP 确认不替代数据库与 STARLIMS 的权限管理。不要把通用脚本执行权限当成数据库只读权限。

## 服务包

新增且仅新增以下自有脚本，不修改 STARLIMS 原生方法：

- `SCM_API.McpQueryDatabase`：查询 HTTP 入口。
- `SCM_API.McpExecuteDatabaseChange`：修改 HTTP 入口。
- `SCM_API.McpDatabaseAccess`：共享校验、查询、事务实现。

调用系统的 `GetDBMSProviderName`、`GetNETDataSet`、`LSearch`、`RunSQL`、`LimsRecordsAffected`、`BeginLimsTransaction`、`EndLimsTransaction`、`SetSqlTimeout`。参考：[SSL 数据库函数](https://mahoskye.github.io/starlims-ssl-reference/reference/functions/GetNETDataSet/)。脚本纳入统一 SDP；部署兼容服务包并按环境执行签入后才能使用。

## 替代 TENOSQL 的规则

> 临时查询优先使用 query_database，不得为了查询修改 TENOSQL 或其他 DataSource。用户明确要求修改数据时，使用 execute_database_change，并逐次确认 SQL、参数、筛选条件及影响行数上限。接口不可用或 SQL 被拒绝时说明原因，不得改用脚本执行来绕过限制。未知结果先查询核对，不自动重试。页面和业务结果最终由人工验收。

## 验证结果与限制

配套发布通过共享 MCP 的 41 项测试和 DevTools 的 38 项 smoke tests，构建通过。自动测试覆盖 SQL 拒绝规则、参数和行数边界、HTTP 专用路由、独立客户端逐次确认及拒绝、DevTools 完全访问下仍需确认、查询不缓存和事务/超时恢复约束。

当前 STARLIMS + 本地候选版已通过真实 MCP 路径验证：

| 场景 | 结果 |
| --- | --- |
| 参数化常量 SELECT | 正确返回参数值、列类型和行数 |
| NULL 与 maxRows 截断 | NULL 保留；两行结果限制为一行并标注截断 |
| 专用测试表 | 经用户授权创建 MCP_DB_ACCESS_TEST，ORIGREC 自增、ORIGSTS 字符串 |
| 两次 INSERT | 每次单独授权及桌面确认，均影响 1 行并提交 |
| UPDATE ORIGREC=1 | 单次确认后修改为 A，匹配及影响行数均为 1 |
| 匹配两行、上限一行的 UPDATE | 服务端拒绝，回读仍为 1=A、2=N |
| DELETE 清理 | 用户单次批准后匹配并删除 2 行，committed=true，回读为空；保留测试表 |

三个自有脚本已保存并精确回读，仍保留签出；没有修改 TENOSQL、原生方法或业务表。查询直接复用系统 Database 连接，没有读取密码或连接字符串。实测处理了 NATIVESQL 提供程序名称、静态 .NET 类型的 bAsStatic 参数和 ItemArray 的 SSL 1 基索引差异；修复了 DevTools 备用 MCP 进程漏报桌面确认能力的问题。

尚未完成 Oracle、Windows、触发器导致的提交后影响计数异常、断网时的提交结果及并发压力测试。行数上限限制返回和目标修改行，不等于限制数据库扫描量；查询超时按命令生效。超限测试是在事务内计数后阻止写入，不能冒充已经验证了所有写入后回滚场景。

此功能随 starlims-mcp v0.6.0 和 DevTools 1.7.0 Beta 7 发布。DevTools 固定共享包标签与锁文件，并分发相同 SCM_API.sdp。`node scripts/use-local-mcp.mjs` 仅用于相邻源码联调；使用 `npm ci` 恢复发布依赖。
