"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFormResourcesUri = normalizeFormResourcesUri;
exports.decodeFormResourcePayload = decodeFormResourcePayload;
exports.parseFormResources = parseFormResources;
exports.toProgrammaticFormResources = toProgrammaticFormResources;
exports.setFormResourceValue = setFormResourceValue;
exports.contentVersion = contentVersion;
exports.sameFormResources = sameFormResources;
const sha2_js_1 = require("@noble/hashes/sha2.js");
const utils_js_1 = require("@noble/hashes/utils.js");
const randomUUID = () => globalThis.crypto.randomUUID();
const xmldom_1 = require("@xmldom/xmldom");
const XML_PREFIX = /^\s*(?:<\?xml[\s\S]*?\?>\s*)?</i;
function normalizeFormResourcesUri(uri) {
    const normalized = uri.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const match = normalized.match(/^(.*\/(?:HTMLForms|XFDForms))\/(?:XML|CodeBehind|Guide|Resources)\/([^/]+)$/i);
    if (!match) {
        throw new Error('Form Resources requires a URI ending in /HTMLForms/Resources/<form> (the XML, CodeBehind, or Guide URI for the same form is also accepted).');
    }
    return `${match[1]}/Resources/${match[2]}`;
}
function decodeFormResourcePayload(payload) {
    const trimmed = payload.trim();
    if (!trimmed || XML_PREFIX.test(trimmed))
        return payload;
    try {
        const binary = atob(trimmed.replace(/\s+/g, ''));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        return XML_PREFIX.test(decoded) ? decoded : payload;
    }
    catch {
        return payload;
    }
}
function directChild(element, name) {
    return Array.from(element.childNodes).find((node) => node.nodeType === 1 && ((node.localName || node.nodeName).toLowerCase() === name.toLowerCase()));
}
function resourceFormat(document) {
    if (!document.documentElement)
        throw new Error('Missing Form Resources root element.');
    const root = (document.documentElement.localName || document.documentElement.nodeName).toLowerCase();
    if (root === 'resources')
        return 'designer';
    if (root === 'resourcesdataset' || root === 'newdataset' || root === 'dataset')
        return 'programmatic';
    throw new Error(`Unsupported Form Resources root element '${document.documentElement.nodeName}'. Use ResourcesDataset for SCM_API or Resources for designer-paste input.`);
}
function resourceRows(document, format) {
    const rowName = format === 'designer' ? 'Resource' : 'ResourcesTable';
    return Array.from(document.getElementsByTagName('*')).filter((element) => ((element.localName || element.nodeName).toLowerCase() === rowName.toLowerCase()));
}
function parseDocument(xml) {
    const document = new xmldom_1.DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(xml, 'application/xml');
    const parserError = document.getElementsByTagName('parsererror')[0];
    if (!document.documentElement || parserError) {
        throw new Error(`Invalid Form Resources XML${parserError?.textContent ? `: ${parserError.textContent.trim()}` : '.'}`);
    }
    return document;
}
function parseFormResources(payload) {
    const xml = decodeFormResourcePayload(payload);
    const document = parseDocument(xml);
    const format = resourceFormat(document);
    // A Form's <Resources><Data>...</Data></Resources> is a loading binding,
    // never a resource list. Do not silently interpret it as an empty dataset.
    const expectedRow = format === 'designer' ? 'resource' : 'resourcestable';
    for (const node of Array.from(document.documentElement.childNodes)) {
        if (node.nodeType !== 1)
            continue;
        const element = node;
        if (element.namespaceURI === 'http://www.w3.org/2001/XMLSchema')
            continue;
        if ((element.localName || element.nodeName).toLowerCase() !== expectedRow) {
            throw new Error('Expected resource data rows, not Form XML or a Resources loading binding. Use ResourcesDataset/ResourcesTable or designer Resources/Resource.');
        }
    }
    const idName = format === 'designer' ? 'Id' : 'ResourceId';
    const valueName = format === 'designer' ? 'Value' : 'ResourceValue';
    const rows = resourceRows(document, format);
    for (const row of rows) {
        if (row.parentNode !== document.documentElement || !directChild(row, valueName)) {
            throw new Error('Resource rows must be direct children and include a value element (an empty element is allowed).');
        }
    }
    const resources = rows.map((row) => ({
        resourceId: directChild(row, idName)?.textContent || '',
        resourceValue: directChild(row, valueName)?.textContent || '',
        guid: directChild(row, 'Guid')?.textContent || undefined
    }));
    const ids = new Set();
    for (const entry of resources) {
        if (ids.has(entry.resourceId))
            throw new Error(`Form Resources contains duplicate ResourceId '${entry.resourceId}'.`);
        ids.add(entry.resourceId);
    }
    const rowName = format === 'designer' ? 'Resource' : 'ResourcesTable';
    if (resources.some((entry) => !entry.resourceId.trim())) {
        throw new Error(`Form Resources contains a ${rowName} row without a valid ID.`);
    }
    return { xml, resources, format };
}
function appendTextElement(document, parent, name, value) {
    const element = parent.namespaceURI ? document.createElementNS(parent.namespaceURI, name) : document.createElement(name);
    element.appendChild(document.createTextNode(value));
    parent.appendChild(element);
    return element;
}
function serializeProgrammaticResources(resources) {
    const outputDocument = new xmldom_1.DOMImplementation().createDocument('http://tempuri.org/ResourcesDataset.xsd', 'ResourcesDataset', null);
    const root = outputDocument.documentElement;
    if (!root)
        throw new Error('Could not create ResourcesDataset.');
    for (const entry of resources) {
        const row = outputDocument.createElementNS(root.namespaceURI, 'ResourcesTable');
        appendTextElement(outputDocument, row, 'Guid', entry.guid || randomUUID());
        appendTextElement(outputDocument, row, 'ResourceId', entry.resourceId);
        appendTextElement(outputDocument, row, 'ResourceValue', entry.resourceValue);
        root.appendChild(row);
    }
    return new xmldom_1.XMLSerializer().serializeToString(outputDocument);
}
function toProgrammaticFormResources(payload, currentPayload) {
    const parsed = parseFormResources(payload);
    if (parsed.format === 'programmatic')
        return parsed.xml;
    if (!currentPayload)
        return serializeProgrammaticResources(parsed.resources);
    const current = parseFormResources(currentPayload);
    const desired = new Map(parsed.resources.map((entry) => [entry.resourceId, entry]));
    const merged = current.resources.map((entry) => {
        const replacement = desired.get(entry.resourceId);
        if (!replacement)
            return entry;
        desired.delete(entry.resourceId);
        return { ...entry, resourceValue: replacement.resourceValue };
    });
    for (const entry of desired.values()) {
        merged.push(entry);
    }
    return serializeProgrammaticResources(merged);
}
function setFormResourceValue(payload, resourceId, resourceValue) {
    const id = resourceId.trim();
    if (!id)
        throw new Error('ResourceId is required.');
    const document = parseDocument(toProgrammaticFormResources(payload));
    const rows = resourceRows(document, 'programmatic');
    let row = rows.find((candidate) => directChild(candidate, 'ResourceId')?.textContent === id);
    const created = !row;
    if (!row) {
        const rowName = rows[0]?.localName || 'ResourcesTable';
        row = document.documentElement.namespaceURI
            ? document.createElementNS(document.documentElement.namespaceURI, rowName)
            : document.createElement(rowName);
        appendTextElement(document, row, 'Guid', randomUUID());
        appendTextElement(document, row, 'ResourceId', id);
        appendTextElement(document, row, 'ResourceValue', resourceValue);
        document.documentElement.appendChild(row);
    }
    else {
        const valueElement = directChild(row, 'ResourceValue') || appendTextElement(document, row, 'ResourceValue', '');
        while (valueElement.firstChild)
            valueElement.removeChild(valueElement.firstChild);
        valueElement.appendChild(document.createTextNode(resourceValue));
    }
    return { xml: new xmldom_1.XMLSerializer().serializeToString(document), created };
}
function contentVersion(value) {
    return (0, utils_js_1.bytesToHex)((0, sha2_js_1.sha256)(new TextEncoder().encode(value)));
}
function sameFormResources(left, right) {
    const canonical = (value) => parseFormResources(value).resources
        .map(({ resourceId, resourceValue, guid }) => ({ resourceId, resourceValue, guid: guid || '' }))
        .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
//# sourceMappingURL=form-resources.js.map