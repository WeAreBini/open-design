import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const HYPERFRAMES_CLI_ENV = 'OD_HYPERFRAMES_BIN';
export const HYPERFRAMES_BROWSER_ENV = 'HYPERFRAMES_BROWSER_PATH';

/**
 * Known Chromium locations for daemon-only / hosted images.
 * Never auto-download a browser; packaged desktop uses Electron instead.
 */
export const HYPERFRAMES_HOSTED_CHROMIUM_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
] as const;

export function resolveHyperFramesCliPath({
  env = process.env,
  resolvePackage = require.resolve,
}: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  resolvePackage?: (id: string) => string;
} = {}): string {
  const configured = env[HYPERFRAMES_CLI_ENV]?.trim();
  if (configured) return configured;

  try {
    const manifestPath = resolvePackage('hyperframes/package.json');
    return path.join(path.dirname(manifestPath), 'bin', 'hyperframes.mjs');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Bundled HyperFrames CLI is unavailable. Reinstall Open Design so its pinned ` +
        `HyperFrames runtime and native dependencies match this platform. ${detail}`,
    );
  }
}

export function resolveHyperFramesBrowserRuntimePath({
  resolvePackage = require.resolve,
}: {
  resolvePackage?: (id: string) => string;
} = {}): string {
  try {
    const manifestPath = resolvePackage('hyperframes/package.json');
    return path.join(path.dirname(manifestPath), 'dist', 'hyperframe.runtime.iife.js');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Bundled HyperFrames browser runtime is unavailable. Reinstall Open Design so its pinned ` +
        `HyperFrames runtime matches this version. ${detail}`,
    );
  }
}

export function resolveHyperFramesNodeBin(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  execPath: string = process.execPath,
): string {
  return env.OD_NODE_BIN?.trim() || execPath;
}

/**
 * Resolve a headless Chromium path for daemon-only HyperFrames renders.
 *
 * Preference order:
 * 1. Explicit `HYPERFRAMES_BROWSER_PATH`
 * 2. On hosted images (`OD_HOSTED=1`), a Chromium binary already installed at a
 *    known path
 *
 * Desktop / local daemons do not scan the system for Chrome — packaged clients
 * use Electron, and we never auto-download a browser.
 */
export function resolveHyperFramesHeadlessBrowserPath({
  env = process.env,
  candidates = HYPERFRAMES_HOSTED_CHROMIUM_CANDIDATES,
  pathExists = existsSync,
}: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  candidates?: readonly string[];
  pathExists?: (candidate: string) => boolean;
} = {}): string | undefined {
  const configured = env[HYPERFRAMES_BROWSER_ENV]?.trim();
  if (configured) return configured;

  const hosted = env.OD_HOSTED?.trim() === '1';
  if (!hosted) return undefined;

  for (const candidate of candidates) {
    if (pathExists(candidate)) return candidate;
  }
  return undefined;
}
