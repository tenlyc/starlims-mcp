export interface TableReadBackOptions {
    delays?: number[];
    sleep?: (milliseconds: number) => Promise<void>;
}
export declare const tableFieldNames: (tableXml: string) => string[];
export declare function tableDefinitionId(xml: string): string;
/** Native CompareFields prepares SCaptions only for existing fields. New fields
 * need typed Captions or the provider silently drops their translations. */
export declare function prepareTableCaptionXml(xml: string): string;
export declare function tableDefinitionVersion(xml: string): string;
export declare function waitForTableReadBack(read: () => Promise<string>, requestedXml: string, beforeXml: string, options?: TableReadBackOptions): Promise<string>;
//# sourceMappingURL=table-definition.d.ts.map