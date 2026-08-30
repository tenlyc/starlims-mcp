import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as z from 'zod/v4';
import type { StarlimsMcpProfile } from './types.js';

export type StarlimsPermissionPolicy = 'read-only' | 'allow-writes';
export type StarlimsMcpTransport = 'stdio' | 'http';

export interface StarlimsMcpConfig {
  baseUrl: string;
  user: string;
  password: string;
  urlSuffix: string;
  language: string;
  permissionPolicy: StarlimsPermissionPolicy;
  profile: StarlimsMcpProfile;
  transport: StarlimsMcpTransport;
  host: string;
  port: number;
  authToken?: string;
}

type ConfigFile = Partial<Omit<StarlimsMcpConfig, 'password'>> & {
  password?: string;
  passwordEnv?: string;
};

const configSchema = z.object({
  baseUrl: z.string().url(),
  user: z.string().min(1),
  password: z.string().min(1),
  urlSuffix: z.string().regex(/^[A-Za-z0-9_-]+$/),
  language: z.string().min(1),
  permissionPolicy: z.enum(['read-only', 'allow-writes']),
  profile: z.enum(['unified', 'devtools', 'vscode-compat']),
  transport: z.enum(['stdio', 'http']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  authToken: z.string().min(16).optional()
});

function argumentValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

async function loadConfigFile(path: string | undefined): Promise<ConfigFile> {
  if (!path) return {};
  const content = await readFile(resolve(path), 'utf8');
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('STARLIMS MCP config file must contain a JSON object.');
  return parsed as ConfigFile;
}

export async function loadStarlimsMcpConfig(argv: readonly string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<StarlimsMcpConfig> {
  const file = await loadConfigFile(argumentValue(argv, '--config') || env.STARLIMS_MCP_CONFIG);
  const passwordEnvironmentName = env.STARLIMS_PASSWORD_ENV || file.passwordEnv;
  const password = env.STARLIMS_PASSWORD
    || (passwordEnvironmentName ? env[passwordEnvironmentName] : undefined)
    || file.password
    || '';

  const portValue = argumentValue(argv, '--port') || env.STARLIMS_MCP_PORT || String(file.port || 3102);
  const candidate = {
    baseUrl: normalizeBaseUrl(argumentValue(argv, '--base-url') || env.STARLIMS_BASE_URL || file.baseUrl || ''),
    user: argumentValue(argv, '--user') || env.STARLIMS_USER || file.user || '',
    password,
    urlSuffix: argumentValue(argv, '--url-suffix') || env.STARLIMS_URL_SUFFIX || file.urlSuffix || 'lims',
    language: argumentValue(argv, '--language') || env.STARLIMS_LANGUAGE || file.language || 'ENG',
    permissionPolicy: argumentValue(argv, '--permission-policy') || env.STARLIMS_MCP_PERMISSION_POLICY || file.permissionPolicy || 'read-only',
    profile: argumentValue(argv, '--profile') || env.STARLIMS_MCP_PROFILE || file.profile || 'unified',
    transport: argumentValue(argv, '--transport') || env.STARLIMS_MCP_TRANSPORT || file.transport || 'stdio',
    host: argumentValue(argv, '--host') || env.STARLIMS_MCP_HOST || file.host || '127.0.0.1',
    port: Number(portValue),
    authToken: argumentValue(argv, '--auth-token') || env.STARLIMS_MCP_AUTH_TOKEN || file.authToken
  };
  const parsed = configSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`).join('; ');
    throw new Error(`Invalid STARLIMS MCP configuration: ${issues}`);
  }
  if (parsed.data.transport === 'http' && !['127.0.0.1', 'localhost', '::1'].includes(parsed.data.host) && !parsed.data.authToken) {
    throw new Error('HTTP transport on a non-loopback host requires STARLIMS_MCP_AUTH_TOKEN (at least 16 characters).');
  }
  return parsed.data;
}

export function configHelp(): string {
  return [
    'Usage: starlims-mcp [options]',
    '',
    '  --config <file>                JSON config file',
    '  --transport <stdio|http>       MCP transport (default: stdio)',
    '  --profile <unified|devtools|vscode-compat>',
    '  --base-url <url>               STARLIMS base URL',
    '  --user <name>                  STARLIMS user',
    '  --language <id>                Default language (default: ENG)',
    '  --permission-policy <read-only|allow-writes>',
    '  --host <host> --port <port>    HTTP bind address',
    '',
    'Secrets should be supplied with STARLIMS_PASSWORD and STARLIMS_MCP_AUTH_TOKEN.'
  ].join('\n');
}
