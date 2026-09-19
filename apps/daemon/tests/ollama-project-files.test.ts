// We Are Bini change. Apache License 2.0. Copyright 2026 Open Design contributors.

import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeOllamaProjectTool, ollamaToolCallsFromMessage } from '../src/ollama-project-files.js';

const roots: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function projectsRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'od-ollama-files-'));
  roots.push(root);
  return root;
}

describe('Ollama project file tools', () => {
  it('reads tool calls from an Ollama message', () => {
    expect(ollamaToolCallsFromMessage({
      role: 'assistant',
      tool_calls: [{
        function: {
          name: 'write_project_file',
          arguments: { path: 'index.html', content: '<p>Hi</p>' },
        },
      }],
    })).toEqual([{
      name: 'write_project_file',
      arguments: { path: 'index.html', content: '<p>Hi</p>' },
    }]);
  });

  it('writes and reads a project file, and rejects a path that escapes', async () => {
    const root = await projectsRoot();
    const wrote = await executeOllamaProjectTool(root, 'proj-1', {
      name: 'write_project_file',
      arguments: { path: 'notes/hello.txt', content: 'hello' },
    });
    expect(wrote).toContain('Wrote notes/hello.txt');
    await expect(readFile(path.join(root, 'proj-1', 'notes', 'hello.txt'), 'utf8')).resolves.toBe('hello');

    const read = await executeOllamaProjectTool(root, 'proj-1', {
      name: 'read_project_file',
      arguments: { path: 'notes/hello.txt' },
    });
    expect(read).toBe('hello');

    const listed = await executeOllamaProjectTool(root, 'proj-1', {
      name: 'list_project_files',
      arguments: {},
    });
    expect(listed).toContain('notes/hello.txt');

    const escaped = await executeOllamaProjectTool(root, 'proj-1', {
      name: 'read_project_file',
      arguments: { path: '../secret.txt' },
    });
    expect(escaped).toMatch(/invalid file name|path escapes/i);

    await writeFile(path.join(root, 'outside.txt'), 'secret');
    await symlink(path.join(root, 'outside.txt'), path.join(root, 'proj-1', 'linked.txt'));
    const linked = await executeOllamaProjectTool(root, 'proj-1', {
      name: 'read_project_file',
      arguments: { path: 'linked.txt' },
    });
    expect(linked).not.toBe('secret');
  });
});
