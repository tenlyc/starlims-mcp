"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFormResourcesUri = normalizeFormResourcesUri;
exports.decodeFormResourcePayload = decodeFormResourcePayload;
exports.parseFormResources = parseFormResources;
exports.setFormResourceValue = setFormResourceValue;
exports.contentVersion = contentVersion;
exports.sameFormResources = sameFormResources;
const node_crypto_1 = require("node:crypto");
const XML_PREFIX = /^\s*(?:<\?xml[\s\S]*?\?>\s*)?</i;
function decodeXmlEntity(value) {
    return value.replace(/&#(x?[0-9a-f]+);|&(lt|gt|amp|quot|apos);/gi, (match, numeric, named) => {
        if (numeric) {
            const radix = numeric[0].toLowerCase() === 'x' ? 16 : 10;
            return String.fromCodePoint(Number.parseInt(radix === 16 ? numeric.slice(1) : numeric, radix));
        }
        return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[String(named).toLowerCase()] || match;
    });
}
function escapeXml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function xmlNodes(xml) {
    const roots = [];
    const stack = [];
    const tags = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?\s*\/?>/g;
    for (const match of xml.matchAll(tags)) {
        const token = match[0];
        const start = match.index;
        if (token.startsWith('<!--') || token.startsWith('<?') || token.startsWith('<![CDATA['))
            continue;
        const name = match[1];
        if (token.startsWith('</')) {
            const node = stack.pop();
            if (!node || node.name.toLowerCase() !== name.toLowerCase())
                throw new Error(`Invalid Form Resources XML near closing tag ${name}.`);
            node.closeStart = start;
            node.end = start + token.length;
            continue;
        }
        const node = { name, start, openEnd: start + token.length, closeStart: start + token.length, end: start + token.length, children: [] };
        const parent = stack[stack.length - 1];
        if (parent)
            parent.children.push(node);
        else
            roots.push(node);
        if (!token.endsWith('/>'))
            stack.push(node);
    }
    if (stack.length)
        throw new Error(`Invalid Form Resources XML: unclosed tag ${stack[stack.length - 1].name}.`);
    return roots;
}
function nodeText(xml, node) {
    return node ? decodeXmlEntity(xml.slice(node.openEnd, node.closeStart)) : undefined;
}
function resourceRows(xml) {
    const rows = [];
    const visit = (node) => {
        const child = (name) => node.children.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
        const resourceId = nodeText(xml, child('ResourceId'));
        if (resourceId !== undefined) {
            rows.push({
                full: xml.slice(node.start, node.end),
                tag: node.name,
                start: node.start,
                end: node.end,
                entry: { resourceId, resourceValue: nodeText(xml, child('ResourceValue')) || '', guid: nodeText(xml, child('Guid')) }
            });
            return;
        }
        node.children.forEach(visit);
    };
    xmlNodes(xml).forEach(visit);
    return rows;
}
function normalizeFormResourcesUri(uri) {
    const normalized = uri.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const match = normalized.match(/^(.*\/(?:HTMLForms|XFDForms))\/(?:XML|CodeBehind|Guide|Resources)\/([^/]+)$/i);
    if (!match)
        throw new Error('Form Resources URI must identify an HTML/XFD form XML, CodeBehind, Guide, or Resources document.');
    return `${match[1]}/Resources/${match[2]}`;
}
function decodeFormResourcePayload(payload) {
    const trimmed = payload.trim();
    if (!trimmed || (XML_PREFIX.test(trimmed) && trimmed.includes('<')))
        return payload;
    try {
        const decoded = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8');
        return XML_PREFIX.test(decoded) && decoded.includes('<') ? decoded : payload;
    }
    catch {
        return payload;
    }
}
function parseFormResources(payload) {
    const xml = decodeFormResourcePayload(payload);
    if (!xml.trim().startsWith('<') || !xml.trim().endsWith('>'))
        throw new Error('Invalid Form Resources XML.');
    return { xml, resources: resourceRows(xml).map((row) => row.entry) };
}
function setFormResourceValue(payload, resourceId, resourceValue) {
    const id = resourceId.trim();
    if (!id)
        throw new Error('ResourceId is required.');
    const parsed = parseFormResources(payload);
    const rows = resourceRows(parsed.xml);
    const row = rows.find((candidate) => candidate.entry.resourceId === id);
    if (row) {
        const valuePattern = /<ResourceValue(?:\s[^>]*)?>[\s\S]*?<\/ResourceValue>/i;
        const replacement = `<ResourceValue>${escapeXml(resourceValue)}</ResourceValue>`;
        const updatedRow = valuePattern.test(row.full)
            ? row.full.replace(valuePattern, replacement)
            : row.full.replace(new RegExp(`</${row.tag}>$`, 'i'), `${replacement}</${row.tag}>`);
        return { xml: `${parsed.xml.slice(0, row.start)}${updatedRow}${parsed.xml.slice(row.end)}`, created: false };
    }
    const rowTag = rows[0]?.tag || 'ResourcesTable';
    const newRow = `<${rowTag}><Guid>${(0, node_crypto_1.randomUUID)()}</Guid><ResourceId>${escapeXml(id)}</ResourceId><ResourceValue>${escapeXml(resourceValue)}</ResourceValue></${rowTag}>`;
    const rootClose = parsed.xml.match(/<\/([A-Za-z_][\w:.-]*)>\s*$/);
    if (!rootClose)
        throw new Error('Unable to locate the Form Resources root element.');
    const index = rootClose.index;
    return { xml: `${parsed.xml.slice(0, index)}${newRow}${parsed.xml.slice(index)}`, created: true };
}
function contentVersion(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex');
}
function sameFormResources(left, right) {
    const canonical = (value) => parseFormResources(value).resources
        .map(({ resourceId, resourceValue, guid }) => ({ resourceId, resourceValue, guid: guid || '' }))
        .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
//# sourceMappingURL=form-resources.js.map