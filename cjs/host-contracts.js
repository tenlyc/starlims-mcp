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
exports.HOST_TOOL_CONTRACTS = void 0;
const z = __importStar(require("zod/v4"));
const menu_schema_js_1 = require("./menu-schema.js");
const visualDefinitions = [
    { id: 'open_form_preview', title: 'Open form preview', description: 'Request navigation to a STARLIMS HTML Form runtime. Opening executes form load handlers. opened is not a runtime success assertion; inspect status, content and errors after loading.', capability: 'forms.preview.open', schema: z.object({ uri: z.string(), guid: z.string().optional(), language: z.string().optional(), mode: z.enum(['run', 'debug']).optional() }) },
    { id: 'refresh_form_preview', title: 'Refresh form preview', description: 'Refresh the active integrated STARLIMS HTML Form preview.', capability: 'forms.preview.control', schema: z.object({}) },
    { id: 'set_preview_viewport', title: 'Set preview viewport', description: 'Set the active form preview to responsive, desktop, tablet, or mobile width.', capability: 'forms.preview.control', schema: z.object({ viewport: z.enum(['responsive', 'desktop', 'tablet', 'mobile']) }) },
    { id: 'capture_form_screenshot', title: 'Capture form screenshot', description: 'Capture the active form preview and return a local PNG path for visual review.', capability: 'forms.preview.capture', schema: z.object({}) },
    { id: 'inspect_form_element', title: 'Inspect form element', description: 'Inspect a DOM element in the active form preview by CSS selector or STARLIMS control ID.', capability: 'forms.preview.inspect', schema: z.object({ selector: z.string().optional(), controlId: z.string().optional() }) },
    { id: 'get_preview_console_errors', title: 'Get preview console errors', description: 'Read JavaScript warnings and errors captured from the active form preview.', capability: 'forms.preview.logs', schema: z.object({}) },
    { id: 'get_preview_load_errors', title: 'Get preview load errors', description: 'Read navigation and page-load errors captured from the active form preview.', capability: 'forms.preview.logs', schema: z.object({}) }
];
const localDefinitions = [...Object.entries(menu_schema_js_1.menuSchemas).map(([id, inputSchema]) => ({
        id, title: id, description: { get_menu_configuration: 'Read native HTML menu configuration and role IDs.', plan_menu_item: 'Prepare a create-only menu plan for an existing group. No writes. ' + menu_schema_js_1.MENU_WORKFLOW_INSTRUCTIONS, apply_menu_item: 'Apply a user-confirmed menu plan and verify configuration. Grants menu access to specified roles. Uses the separate SCM_API.MenuManagement transaction; does not modify system designer methods. Runtime acceptance is separate.' }[id],
        origin: 'starlims-mcp', repository: 'https://github.com/tenlyc/starlims-mcp', provenance: { repository: 'https://github.com/tenlyc/starlims-mcp', owner: 'tenlyc/starlims-mcp' }, risk: id === 'apply_menu_item' ? 'write' : 'read', capability: id === 'apply_menu_item' ? 'menus.write' : 'menus.read', schemaVersion: '1.0', profiles: ['devtools'], inputSchema
    })), {
        id: 'validate_ssl',
        title: 'Validate STARLIMS SSL',
        description: 'Validate STARLIMS Scripting Language code with the bundled starlims-lsp. Use before saving Server Scripts, Data Sources, and other SSL code.',
        origin: 'starlims-mcp',
        repository: 'https://github.com/tenlyc/starlims-mcp',
        provenance: { repository: 'https://github.com/tenlyc/starlims-mcp', owner: 'tenlyc/starlims-mcp' },
        risk: 'read',
        capability: 'ssl.validate',
        schemaVersion: '1.0',
        profiles: ['devtools'],
        inputSchema: z.object({
            code: z.string().min(1).describe('Complete STARLIMS SSL source code to validate.'),
            dataSource: z.boolean().optional().describe('Enable Data Source-specific syntax rules.'),
            includeInfo: z.boolean().optional().describe('Include informational diagnostics.'),
            hungarianTypes: z.boolean().optional().describe('Enable Hungarian variable type checks.')
        })
    }, {
        id: 'get_editor_diagnostics',
        title: 'Get editor diagnostics',
        description: 'Read the Problems panel diagnostics for the current file, open files, or all indexed files. Use this when diagnosing or verifying an editor problem.',
        origin: 'starlims-mcp',
        repository: 'https://github.com/tenlyc/starlims-mcp',
        provenance: { repository: 'https://github.com/tenlyc/starlims-mcp', owner: 'tenlyc/starlims-mcp' },
        risk: 'read',
        capability: 'diagnostics.read',
        schemaVersion: '1.0',
        profiles: ['devtools'],
        inputSchema: z.object({
            uri: z.string().optional().describe('Exact editor URI. Defaults to the active editor.'),
            scope: z.enum(['current', 'open', 'all']).optional().describe('Diagnostic scope when uri is omitted.'),
            levels: z.array(z.enum(['error', 'warning', 'info'])).optional().describe('Optional severity filter.'),
            maxItems: z.number().int().min(1).max(200).optional().describe('Maximum diagnostics to return.')
        })
    }, {
        id: 'get_devtools_output',
        title: 'Get DevTools output',
        description: 'Read recent entries from the DevTools Output panel, newest first. Use channel and level filters to keep troubleshooting focused.',
        origin: 'starlims-mcp',
        repository: 'https://github.com/tenlyc/starlims-mcp',
        provenance: { repository: 'https://github.com/tenlyc/starlims-mcp', owner: 'tenlyc/starlims-mcp' },
        risk: 'read',
        capability: 'devtools.logs.read',
        schemaVersion: '1.0',
        profiles: ['devtools'],
        inputSchema: z.object({
            channel: z.enum(['starlims-operation', 'starlims-api', 'ssl-language', 'mcp-server', 'mcp-tools', 'ai-runtime']).optional().describe('Optional Output channel filter.'),
            levels: z.array(z.enum(['info', 'warning', 'error', 'success', 'script'])).optional().describe('Optional log-level filter.'),
            maxItems: z.number().int().min(1).max(200).optional().describe('Maximum entries to return.')
        })
    }];
const provenance = { repository: 'https://github.com/tenlyc/starlims-mcp', owner: 'tenlyc/starlims-mcp', license: 'MIT', relationship: 'original' };
exports.HOST_TOOL_CONTRACTS = [
    ...localDefinitions.map(tool => ({ ...tool, origin: 'starlims-mcp', profiles: ['unified', 'devtools'], provenance })),
    ...visualDefinitions.map(tool => ({ id: tool.id, title: tool.title, description: tool.description, inputSchema: tool.schema, capability: tool.capability, origin: 'starlims-mcp', provenance, profiles: ['unified', 'devtools'], schemaVersion: '1.0', risk: ['open_form_preview', 'refresh_form_preview'].includes(tool.id) ? 'execute' : 'read' }))
];
//# sourceMappingURL=host-contracts.js.map