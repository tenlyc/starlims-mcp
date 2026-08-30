import { getProfileTools } from './catalog.js';
import type { StarlimsCapabilityDocument, StarlimsMcpAdapter, StarlimsMcpProfile } from './types.js';

export async function buildCapabilityDocument(options: {
  serverName?: string;
  version: string;
  profile: StarlimsMcpProfile;
  adapter: StarlimsMcpAdapter;
}): Promise<StarlimsCapabilityDocument> {
  const tools = getProfileTools(options.profile, options.adapter.capabilities);
  const backend = options.adapter.backendComponents ? await options.adapter.backendComponents() : [];
  return {
    server: options.serverName || 'starlims-mcp',
    version: options.version,
    serverProvenance: {
      repository: 'https://github.com/tenlyc/starlims-mcp',
      owner: 'tenlyc/starlims-mcp',
      license: 'MIT',
      relationship: 'original'
    },
    profile: options.profile,
    adapter: options.adapter.id,
    capabilities: [...options.adapter.capabilities],
    tools: tools.map(({ id, title, origin, provenance, risk, capability, schemaVersion, profiles }) => ({ id, title, origin, provenance, risk, capability, schemaVersion, profiles })),
    backend: [...backend]
  };
}
