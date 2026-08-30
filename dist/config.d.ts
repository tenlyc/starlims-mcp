import type { StarlimsMcpProfile } from './types.js';
export type StarlimsPermissionPolicy = 'read-only' | 'allow-writes';
export type StarlimsMcpTransport = 'stdio' | 'http';
export interface StarlimsMcpConfig {
    baseUrl: string;
    user: string;
    password: string;
    urlSuffix: string;
    language: string;
    permissionPolicy: StarlimsPermissionPolicy;
    profile: StarlimsMcpProfile;
    transport: StarlimsMcpTransport;
    host: string;
    port: number;
    authToken?: string;
}
export declare function loadStarlimsMcpConfig(argv?: readonly string[], env?: NodeJS.ProcessEnv): Promise<StarlimsMcpConfig>;
export declare function configHelp(): string;
//# sourceMappingURL=config.d.ts.map