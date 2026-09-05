# SCM_API owned extensions

STARLIMS installations receive one merged `SCM_API.sdp`. The regular script
names are preserved from the pinned `MrDoe/starlimsvscode` baseline. Scripts
owned by `tenlyc/starlims-mcp` use the `Mcp*` prefix to prevent collisions while
remaining inside the same deployable namespace.

Current owned extensions are `McpGetSCMUsers`, `McpGetCheckInHistory`,
`McpExportPackage`, and `McpImportPackage`. Host UI and adapters remain in their
product repositories. No script is added until its contract, provenance,
security classification, compatibility range, tests, and upgrade path are
documented.

Database access is owned here as McpQueryDatabase, McpExecuteDatabaseChange and McpDatabaseAccess. See [database access](../../../docs/DATABASE_ACCESS.md) for contracts, scope, approvals and test limitations.
