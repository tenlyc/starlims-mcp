export interface FormResourceEntry {
    resourceId: string;
    resourceValue: string;
    guid?: string;
}
export declare function normalizeFormResourcesUri(uri: string): string;
export declare function decodeFormResourcePayload(payload: string): string;
export declare function parseFormResources(payload: string): {
    xml: string;
    resources: FormResourceEntry[];
};
export declare function setFormResourceValue(payload: string, resourceId: string, resourceValue: string): {
    xml: string;
    created: boolean;
};
export declare function contentVersion(value: string): string;
export declare function sameFormResources(left: string, right: string): boolean;
//# sourceMappingURL=form-resources.d.ts.map