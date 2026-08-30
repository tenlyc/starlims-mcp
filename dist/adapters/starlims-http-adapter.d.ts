import type { StarlimsMcpConfig } from '../config.js';
import type { StarlimsLogger } from '../logger.js';
import type { BackendComponentVersion, StarlimsMcpAdapter } from '../types.js';
type FetchLike = typeof fetch;
export declare class StarlimsHttpAdapter implements StarlimsMcpAdapter {
    readonly config: StarlimsMcpConfig;
    private readonly logger;
    private readonly fetchImpl;
    readonly id = "starlims-http";
    readonly capabilities: readonly string[];
    private backendVersion?;
    private connected;
    constructor(config: StarlimsMcpConfig, logger: StarlimsLogger, fetchImpl?: FetchLike);
    connect(): Promise<void>;
    backendComponents: () => readonly BackendComponentVersion[];
    invoke(tool: string, arguments_: Record<string, unknown>): Promise<unknown>;
    private assertWriteAllowed;
    private language;
    private request;
    private normalizeItems;
    private browseTree;
    private searchByName;
    private globalCodeSearch;
    private listLanguages;
    private readCode;
    private getItemCodeTool;
    private getTableDefinition;
    private getFormResources;
    private checkout;
    private saveVerified;
    private saveItem;
    private checkin;
    private saveFormResources;
    private setFormResource;
}
export {};
//# sourceMappingURL=starlims-http-adapter.d.ts.map