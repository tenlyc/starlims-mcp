import * as z from 'zod/v4';
export declare const menuSchemas: {
    get_menu_configuration: z.ZodObject<{
        group: z.ZodOptional<z.ZodString>;
        itemName: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    plan_menu_item: z.ZodObject<{
        group: z.ZodString;
        itemName: z.ZodString;
        formUri: z.ZodString;
        captions: z.ZodRecord<z.ZodString, z.ZodString>;
        roles: z.ZodArray<z.ZodString>;
        position: z.ZodOptional<z.ZodNumber>;
        parameterScript: z.ZodDefault<z.ZodString>;
    }, z.core.$strict>;
    apply_menu_item: z.ZodObject<{
        planId: z.ZodString;
    }, z.core.$strict>;
};
export type MenuInput = z.infer<typeof menuSchemas.plan_menu_item>;
export declare const MENU_WORKFLOW_INSTRUCTIONS = "After completing and runtime-validating a new HTML page, ask whether to add it to the STARLIMS menu. Collect existing group, internal item name, localized captions, parameters and allowed roles; reuse explicit answers. Use get_menu_configuration then plan_menu_item and show its concrete result before apply_menu_item. Do not assume preview login role grants menu access. Never claim menu acceptance until the actual menu is refreshed and its entry opens the correct page under the requested role. First version creates HTML Application entries in existing groups; it does not overwrite existing items.";
//# sourceMappingURL=menu-schema.d.ts.map