// We Are Bini change. Apache License 2.0. Copyright 2026 Open Design contributors.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: write-dsh-manifest.mjs <directory>');
  process.exit(1);
}
const files = (await readdir(dir)).filter((name) => name.endsWith('.tgz'));
if (files.length !== 1) {
  console.error(`Expected one DeepSeek Harness tarball, found ${files.length}.`);
  process.exit(1);
}
const file = files[0];
const bytes = await readFile(path.join(dir, file));
const pkg = JSON.parse(await readFile('/app/packages/dsh-runtime/package.json', 'utf8'));
const manifest = {
  file,
  packageName: pkg.name,
  schemaVersion: 1,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  version: pkg.version,
};
await writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
