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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpReadCacheKey = exports.MCP_EFFICIENCY_INSTRUCTIONS = exports.MENU_WORKFLOW_INSTRUCTIONS = exports.menuSchemas = void 0;
// Browser-safe shared schemas and workflow helpers; no server or Node imports.
var menu_schema_js_1 = require("./menu-schema.js");
Object.defineProperty(exports, "menuSchemas", { enumerable: true, get: function () { return menu_schema_js_1.menuSchemas; } });
Object.defineProperty(exports, "MENU_WORKFLOW_INSTRUCTIONS", { enumerable: true, get: function () { return menu_schema_js_1.MENU_WORKFLOW_INSTRUCTIONS; } });
var workflow_instructions_js_1 = require("./workflow-instructions.js");
Object.defineProperty(exports, "MCP_EFFICIENCY_INSTRUCTIONS", { enumerable: true, get: function () { return workflow_instructions_js_1.MCP_EFFICIENCY_INSTRUCTIONS; } });
Object.defineProperty(exports, "mcpReadCacheKey", { enumerable: true, get: function () { return workflow_instructions_js_1.mcpReadCacheKey; } });
__exportStar(require("./query-database.js"), exports);
//# sourceMappingURL=browser.js.map