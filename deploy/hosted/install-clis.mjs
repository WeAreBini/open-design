// We Are Bini change. Apache License 2.0. Copyright 2026 Open Design contributors.
// Downloads pinned Claude, Codex, and Grok binaries into the image.
// Grok sign-in stays on the volume. This script does not copy auth files.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const prefix = '/opt/hosted-clis';
const bindir = path.join(prefix, 'bin');

const lock = JSON.parse(await readFile(path.join(here, 'linux-clis.lock.json'), 'utf8'));

async function download(url, sha256) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`Download failed ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256) throw new Error(`SHA-256 mismatch for ${url}`);
  return bytes;
}

await mkdir(bindir, { recursive: true });
await mkdir(path.join(prefix, 'lib'), { recursive: true });

const claudeBytes = await download(lock.claude.url, lock.claude.sha256);
const claudeArchive = path.join(prefix, 'claude.tgz');
await writeFile(claudeArchive, claudeBytes);
await exec('tar', ['-xzf', claudeArchive, '-C', prefix]);
await copyFile(path.join(prefix, 'package', 'claude'), path.join(bindir, 'claude'));
await chmod(path.join(bindir, 'claude'), 0o755);
await rm(claudeArchive, { force: true });
await rm(path.join(prefix, 'package'), { recursive: true, force: true });

const codexBytes = await download(lock.codex.url, lock.codex.sha256);
const codexArchive = path.join(prefix, 'codex.tar.gz');
const codexRoot = path.join(prefix, 'codex');
await writeFile(codexArchive, codexBytes);
await mkdir(codexRoot, { recursive: true });
await exec('tar', ['-xzf', codexArchive, '-C', codexRoot]);
await chmod(path.join(codexRoot, 'bin', 'codex'), 0o755);
await exec('ln', ['-sfn', path.join(codexRoot, 'bin', 'codex'), path.join(bindir, 'codex')]);
await rm(codexArchive, { force: true });

const grokBytes = await download(lock.grok.url, lock.grok.sha256);
const grokBin = path.join(prefix, 'lib', 'grok.bin');
await writeFile(grokBin, grokBytes);
await chmod(grokBin, 0o755);
await copyFile(path.join(here, 'grok'), path.join(bindir, 'grok'));
await chmod(path.join(bindir, 'grok'), 0o755);

await mkdir(path.join(prefix, 'dsh-runtime'), { recursive: true });
await copyFile(path.join(here, 'dsh-package.json'), path.join(prefix, 'dsh-runtime', 'package.json'));
await exec('npm', ['install', '-g', 'bun@1.2.22']);
await exec('bun', ['install'], { cwd: path.join(prefix, 'dsh-runtime') });
await chmod(path.join(prefix, 'dsh-runtime', 'node_modules'), 0o777);
const dshBin = path.join(prefix, 'dsh-runtime', 'node_modules', '.bin', 'dsh');
await exec('ln', ['-sfn', dshBin, path.join(bindir, 'dsh')]);
await exec('corepack', ['enable']);
await exec('corepack', ['prepare', 'pnpm@10.33.2', '--activate']);

process.stdout.write('Installed Claude, Codex, Grok, and DeepSeek Harness binaries.\n');
