import { STARLIMS_TOOL_CATALOG, getProfileTools } from '../dist/index.js';
import { writeFile, readFile } from 'node:fs/promises';
const counts = ['unified', 'devtools', 'vscode-compat'].map(profile => `${profile}: ${getProfileTools(profile).length + 1} tools including get_capabilities`).join('; ');
const lines = ['# MCP tool reference / 接口目录', '', 'Generated from the shared catalog. Do not edit this table by hand.', '', counts, '', 'Tools are filtered by adapter support and permission policy. Profiles describe contracts, not a promise that every adapter implements every tool.', '', '| Tool | Capability | Risk | Profiles |', '| --- | --- | --- | --- |', '| get_capabilities | discovery | read | all |', ...STARLIMS_TOOL_CATALOG.map(t => `| ${t.id} | ${t.capability} | ${t.risk} | ${t.profiles.join(', ')} |`), '', 'All DevTools tools are registered by createStarlimsMcpServer from this catalog. DevTools supplies an adapter and must not append tools or modify their schemas.', ''];
const content = lines.join('\n');
const file = new URL('../docs/TOOLS.md', import.meta.url);
if (process.argv.includes('--check')) {
 if (await readFile(file, 'utf8') !== content) throw new Error('Tool reference is stale. Run npm run docs:tools.');
} else await writeFile(file, content);
