import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..');
const clientPath = join(root, 'hosted/bini/extensions/od-bini.js');
const installPath = join(root, 'hosted/bini/bin/install-improve-prompt-client.sh');
const entrypointPath = join(root, 'hosted/entrypoint.sh');
const dockerfilePath = join(root, 'Dockerfile');

describe('Improve Prompt progress client', () => {
  it('ships accessible in-progress stages and double-submit guard', () => {
    const source = readFileSync(clientPath, 'utf8');
    assert.match(source, /aria-live["']?\s*,?\s*["']polite["']/);
    assert.match(source, /role["']?\s*,?\s*["']status["']/);
    assert.match(source, /Asking a clarifying question/);
    assert.match(source, /Writing the brief/);
    assert.match(source, /Starting Improve Prompt/);
    assert.match(source, /inFlight/);
    assert.match(source, /askThenImprove/);
    assert.match(source, /\/api\/bini\/improve-prompt/);
    assert.match(source, /prefers-reduced-motion/);
    // Must not invent a second auth path.
    assert.doesNotMatch(source, /OD_LAYA|OPENBOT_LAYA|laya/i);
    assert.doesNotMatch(source, /access_token|refresh_token/);
  });

  it('installs client over volume and web out without touching auth files', () => {
    const install = readFileSync(installPath, 'utf8');
    assert.match(install, /\/app\/\.od\/extensions\/od-bini\.js/);
    assert.match(install, /\/app\/apps\/web\/out\/od-bini\.js/);
    assert.doesNotMatch(install, /auth\.json|grok-token-fetch|cp .*improve-prompt/);
    const mode = statSync(installPath).mode & 0o111;
    assert.ok(mode !== 0, 'install script must be executable');
  });

  it('entrypoint re-asserts the progress client after volume apply', () => {
    const entry = readFileSync(entrypointPath, 'utf8');
    assert.match(entry, /install-improve-prompt-client\.sh/);
    assert.match(entry, /install_improve_prompt_client/);
  });

  it('Dockerfile keeps the bini client in the runtime image', () => {
    const docker = readFileSync(dockerfilePath, 'utf8');
    assert.match(docker, /COPY deploy\/hosted\/bini \/app\/deploy\/hosted\/bini/);
  });
});
