import * as z from 'zod/v4';
import type { StarlimsMcpProfile, StarlimsToolOrigin, StarlimsToolRisk } from './types.js';
export interface StarlimsToolContract {
    id: string;
    title: string;
    description: string;
    origin: StarlimsToolOrigin;
    risk: StarlimsToolRisk;
    capability: string;
    schemaVersion: string;
    profiles: readonly StarlimsMcpProfile[];
    inputSchema: z.ZodType;
    adapterTool?: string;
}
export declare const STARLIMS_TOOL_CATALOG: readonly StarlimsToolContract[];
export declare function getProfileTools(profile: StarlimsMcpProfile, capabilities?: readonly string[]): readonly StarlimsToolContract[];
export declare function findToolContract(id: string): StarlimsToolContract | undefined;
//# sourceMappingURL=catalog.d.ts.map