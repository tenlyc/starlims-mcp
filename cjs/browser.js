"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpReadCacheKey = exports.MCP_EFFICIENCY_INSTRUCTIONS = exports.MENU_WORKFLOW_INSTRUCTIONS = exports.menuSchemas = void 0;
// Browser-safe shared schemas and workflow helpers; no server or Node imports.
var menu_schema_js_1 = require("./menu-schema.js");
Object.defineProperty(exports, "menuSchemas", { enumerable: true, get: function () { return menu_schema_js_1.menuSchemas; } });
Object.defineProperty(exports, "MENU_WORKFLOW_INSTRUCTIONS", { enumerable: true, get: function () { return menu_schema_js_1.MENU_WORKFLOW_INSTRUCTIONS; } });
var workflow_instructions_js_1 = require("./workflow-instructions.js");
Object.defineProperty(exports, "MCP_EFFICIENCY_INSTRUCTIONS", { enumerable: true, get: function () { return workflow_instructions_js_1.MCP_EFFICIENCY_INSTRUCTIONS; } });
Object.defineProperty(exports, "mcpReadCacheKey", { enumerable: true, get: function () { return workflow_instructions_js_1.mcpReadCacheKey; } });
//# sourceMappingURL=browser.js.map