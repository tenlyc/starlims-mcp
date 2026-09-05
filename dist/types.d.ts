export type StarlimsToolOrigin = 'starlimsvscode' | 'starlims-mcp';
export type StarlimsToolRisk = 'read' | 'write' | 'execute' | 'destructive';
export type StarlimsMcpProfile = 'unified' | 'devtools' | 'vscode-compat';
export type StarlimsSourceRelationship = 'upstream-compatible' | 'derived-from-upstream' | 'original';
export interface StarlimsToolProvenance {
    repository: string;
    owner: string;
    license: string;
    relationship: StarlimsSourceRelationship;
    sourceCommit?: string;
    note?: string;
}
export interface BackendComponentVersion {
    name: string;
    version?: string;
    source?: string;
    commit?: string;
    checksum?: string;
}
export interface StarlimsMcpAdapter {
    /** Trusted host adapter must enforce a fresh human approval for every database change, including direct runtime calls. */
    readonly confirmsDatabaseChanges?: boolean;
    id: string;
    capabilities: readonly string[];
    invoke(tool: string, arguments_: Record<string, unknown>): Promise<unknown>;
    backendComponents?: () => Promise<readonly BackendComponentVersion[]> | readonly BackendComponentVersion[];
}
export interface StarlimsToolSummary {
    id: string;
    title: string;
    origin: StarlimsToolOrigin;
    provenance: StarlimsToolProvenance;
    risk: StarlimsToolRisk;
    capability: string;
    schemaVersion: string;
    profiles: readonly StarlimsMcpProfile[];
}
export interface StarlimsCapabilityDocument {
    server: string;
    version: string;
    serverProvenance: StarlimsToolProvenance;
    profile: StarlimsMcpProfile;
    adapter: string;
    capabilities: readonly string[];
    tools: readonly StarlimsToolSummary[];
    backend: readonly BackendComponentVersion[];
}
//# sourceMappingURL=types.d.ts.map