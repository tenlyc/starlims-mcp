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
    profile: options.profile,
    adapter: options.adapter.id,
    capabilities: [...options.adapter.capabilities],
    tools: tools.map(({ id, title, origin, risk, capability, schemaVersion }) => ({ id, title, origin, risk, capability, schemaVersion })),
    backend: [...backend]
  };
}
