// We Are Bini change. Apache License 2.0. Copyright 2026 Open Design contributors.
// Ollama chat is not a CLI agent. These tools let that chat read and write
// the active project through the same project file boundary as the daemon.

import { isSafeId, listFiles, readProjectFile, writeProjectFile } from './projects.js';

const READ_CHAR_CAP = 24_000;
const WRITE_BYTE_CAP = 512_000;
const LIST_CAP = 200;

export const OLLAMA_PROJECT_FILE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_project_files',
      description: 'List files in the active Open Design project. Paths are relative to that project folder.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_project_file',
      description: 'Read a UTF-8 text file from the active project. The path is relative, for example index.html.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_project_file',
      description: 'Create or replace a UTF-8 text file in the active project. The path is relative. Use this to save a design file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative path' },
          content: { type: 'string', description: 'Full UTF-8 file contents' },
        },
        required: ['path', 'content'],
      },
    },
  },
];

export interface OllamaToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export function ollamaToolCallsFromMessage(message: unknown): OllamaToolCall[] {
  if (!message || typeof message !== 'object') return [];
  const calls = (message as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(calls)) return [];
  const out: OllamaToolCall[] = [];
  for (const call of calls) {
    if (!call || typeof call !== 'object') continue;
    const fn = (call as { function?: unknown }).function;
    const source = fn && typeof fn === 'object' ? fn : call;
    const name = (source as { name?: unknown }).name;
    if (typeof name !== 'string' || !name) continue;
    out.push({ name, arguments: toolArguments((source as { arguments?: unknown }).arguments) });
  }
  return out;
}

function toolArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function stringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' ? value : null;
}

export async function executeOllamaProjectTool(
  projectsRoot: string,
  projectId: string,
  call: OllamaToolCall,
): Promise<string> {
  try {
    if (!isSafeId(projectId)) return 'project id is not valid';
    if (call.name === 'list_project_files') {
      const files = await listFiles(projectsRoot, projectId) as Array<{ name?: unknown }>;
      const names = files
        .map((file) => file.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
      const shown = names.slice(0, LIST_CAP);
      const suffix = names.length > shown.length
        ? `\n… ${names.length - shown.length} more files`
        : '';
      return shown.length > 0 ? `${shown.join('\n')}${suffix}` : 'The project folder has no files.';
    }
    if (call.name === 'read_project_file') {
      const rel = stringArg(call.arguments, 'path');
      if (!rel) return 'path is required';
      const file = await readProjectFile(projectsRoot, projectId, rel) as { buffer: Buffer };
      if (file.buffer.includes(0)) return 'That file is not UTF-8 text.';
      const text = file.buffer.toString('utf8');
      if (text.length <= READ_CHAR_CAP) return text;
      return `${text.slice(0, READ_CHAR_CAP)}\n… truncated`;
    }
    if (call.name === 'write_project_file') {
      const rel = stringArg(call.arguments, 'path');
      const content = stringArg(call.arguments, 'content');
      if (!rel) return 'path is required';
      if (content === null) return 'content is required';
      if (Buffer.byteLength(content) > WRITE_BYTE_CAP) return 'content is too large';
      const written = await writeProjectFile(projectsRoot, projectId, rel, content) as { path: string; size: number };
      return `Wrote ${written.path} (${written.size} bytes).`;
    }
    return `Unknown tool ${call.name}`;
  } catch (err) {
    return err instanceof Error ? err.message : 'tool failed';
  }
}
