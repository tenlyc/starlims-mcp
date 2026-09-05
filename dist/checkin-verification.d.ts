/** Form code, guide and Resources are checked in together with the parent Form. */
export declare function checkinTargetUri(uri: string): string;
/** Fail closed: a malformed/unavailable checkout list is not an empty list. */
export declare function pendingCheckoutIds(data: unknown): string[];
export declare function assertCheckinAccepted(response: {
    success?: unknown;
    data?: unknown;
    message?: unknown;
    error?: unknown;
}): void;
//# sourceMappingURL=checkin-verification.d.ts.map