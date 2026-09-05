"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENU_WORKFLOW_INSTRUCTIONS = exports.menuSchemas = void 0;
const z = __importStar(require("zod/v4"));
exports.menuSchemas = {
    get_menu_configuration: z.object({ group: z.string().trim().min(1).max(32).optional(), itemName: z.string().trim().min(1).max(32).optional() }).strict(),
    plan_menu_item: z.object({
        group: z.string().trim().min(1).max(32), itemName: z.string().trim().min(1).max(32),
        formUri: z.string().regex(/^\/Applications\/[^/]+\/[^/]+\/HTMLForms\/XML\/[^/]+$/),
        captions: z.record(z.string().regex(/^[A-Z]{2,3}$/), z.string().trim().min(1).max(200)).refine(x => Object.keys(x).length > 0),
        roles: z.array(z.string().trim().min(1)).min(1).max(100),
        position: z.number().int().positive().optional(),
        parameterScript: z.string().max(20000).default(''),
    }).strict(),
    apply_menu_item: z.object({ planId: z.string().uuid() }).strict()
};
exports.MENU_WORKFLOW_INSTRUCTIONS = 'After completing and runtime-validating a new HTML page, ask whether to add it to the STARLIMS menu. Collect existing group, internal item name, localized captions, parameters and allowed roles; reuse explicit answers. Use get_menu_configuration then plan_menu_item and show its concrete result before apply_menu_item. Do not assume preview login role grants menu access. Never claim menu acceptance until the actual menu is refreshed and its entry opens the correct page under the requested role. First version creates HTML Application entries in existing groups; it does not overwrite existing items.';
//# sourceMappingURL=menu-schema.js.map