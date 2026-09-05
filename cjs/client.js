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
exports.parseFormResources = exports.normalizeFormResourcesUri = exports.contentVersion = exports.menuRows = exports.MenuMcpService = exports.findToolContract = exports.StarlimsHttpAdapter = void 0;
// Browser-safe server operations. The host supplies credentials, permission gates and fetch/IPC transport.
var starlims_http_adapter_js_1 = require("./adapters/starlims-http-adapter.js");
Object.defineProperty(exports, "StarlimsHttpAdapter", { enumerable: true, get: function () { return starlims_http_adapter_js_1.StarlimsHttpAdapter; } });
var catalog_js_1 = require("./catalog.js");
Object.defineProperty(exports, "findToolContract", { enumerable: true, get: function () { return catalog_js_1.findToolContract; } });
var menu_service_js_1 = require("./menu-service.js");
Object.defineProperty(exports, "MenuMcpService", { enumerable: true, get: function () { return menu_service_js_1.MenuMcpService; } });
Object.defineProperty(exports, "menuRows", { enumerable: true, get: function () { return menu_service_js_1.menuRows; } });
__exportStar(require("./table-definition.js"), exports);
var form_resources_js_1 = require("./form-resources.js");
Object.defineProperty(exports, "contentVersion", { enumerable: true, get: function () { return form_resources_js_1.contentVersion; } });
Object.defineProperty(exports, "normalizeFormResourcesUri", { enumerable: true, get: function () { return form_resources_js_1.normalizeFormResourcesUri; } });
Object.defineProperty(exports, "parseFormResources", { enumerable: true, get: function () { return form_resources_js_1.parseFormResources; } });
//# sourceMappingURL=client.js.map