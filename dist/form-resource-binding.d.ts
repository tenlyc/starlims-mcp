/** Match the native Enterprise_Designer.XFD2HTMLResourcesCopy ResTag3 contract. */
export declare function ensureFormResourceBinding(formXml: string, formId: string, language: string): {
    xml: string;
    changed: boolean;
};
/** Read-only structural diagnostics; this is not a Designer or runtime validation. */
export declare function inspectFormResourceBinding(formXml: string, formId: string, language: string): {
    status: string;
    warnings: string[];
    runtimeVerified: boolean;
    formId?: undefined;
    embeddedGuid?: undefined;
    missingColumnTypes?: undefined;
} | {
    status: string;
    formId: string;
    embeddedGuid: string;
    missingColumnTypes: string[];
    warnings: string[];
    runtimeVerified: boolean;
};
//# sourceMappingURL=form-resource-binding.d.ts.map