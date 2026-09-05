export interface MenuScriptResult {
    success: boolean;
    output?: unknown;
    error?: string;
    rowsTruncated?: boolean;
}
export interface MenuService {
    runDataSource(uri: string, parameters: unknown[], options: {
        outputType: 'JSON';
        maxRows: number;
    }): Promise<MenuScriptResult>;
    runScript(uri: string, parameters: unknown[], options: {
        entryPoint: string;
        outputType: 'ARRAY';
    }): Promise<MenuScriptResult>;
    getItemCode(uri: string, language: string): Promise<string>;
    getSessionKey(): string;
    getLanguages(): Promise<string[]>;
}
type Row = Record<string, unknown>;
export declare function menuRows(result: MenuScriptResult): Row[];
export declare class MenuMcpService {
    private service;
    private plans;
    constructor(service: MenuService);
    private session;
    private read;
    private configuration;
    private form;
    execute(tool: string, args: Record<string, unknown>): Promise<unknown>;
}
export {};
//# sourceMappingURL=menu-service.d.ts.map