export interface StarlimsLogger {
    debug(message: string, detail?: unknown): void;
    info(message: string, detail?: unknown): void;
    error(message: string, detail?: unknown): void;
}
export declare function redactLogValue(value: unknown, secrets?: readonly string[]): string;
export declare function createStderrLogger(options?: {
    debug?: boolean;
    secrets?: readonly string[];
}): StarlimsLogger;
//# sourceMappingURL=logger.d.ts.map