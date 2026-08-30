export type StarlimsToolOrigin = 'shared' | 'starlimsvscode' | 'starlims-devtools' | 'starlims-mcp';
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
