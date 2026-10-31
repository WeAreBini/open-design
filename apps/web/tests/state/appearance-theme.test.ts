// @vitest-environment jsdom
//
// Theme preference is back: light / dark / system. These specs pin the
// apply + resolve path so a dark install stays dark and system follows OS.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ACCENT_COLOR,
  applyAppearanceToDocument,
  normalizeAccentColor,
  resolveAccentColor,
  resolveAppTheme,
} from '../../src/state/appearance';
import { DEFAULT_CONFIG, loadConfig } from '../../src/state/config';
import type { AppConfig } from '../../src/types';

const STORAGE_KEY = 'open-design:config';
const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
  }),
  clear: vi.fn(() => {
    store.clear();
  }),
});

function persist(config: Partial<AppConfig>): void {
  store.set(STORAGE_KEY, JSON.stringify(config));
}

function stubSystemPrefersDark(matches = true): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matches && query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('normalizeAccentColor', () => {
  it('accepts six-digit hex colors and normalizes casing', () => {
    expect(normalizeAccentColor('  #4F46E5  ')).toBe('#4f46e5');
  });

  it('rejects invalid accent colors', () => {
    expect(normalizeAccentColor('blue')).toBeNull();
    expect(normalizeAccentColor('#123')).toBeNull();
  });
});

describe('resolveAccentColor', () => {
  it('falls back to the default accent for missing or invalid values', () => {
    expect(resolveAccentColor(undefined)).toBe(DEFAULT_ACCENT_COLOR);
    expect(resolveAccentColor('blue')).toBe(DEFAULT_ACCENT_COLOR);
  });
});

describe('resolveAppTheme', () => {
  it('keeps light, dark, and system', () => {
    expect(resolveAppTheme('light')).toBe('light');
    expect(resolveAppTheme('dark')).toBe('dark');
    expect(resolveAppTheme('system')).toBe('system');
  });

  it('falls back to light for unknown values', () => {
    expect(resolveAppTheme(undefined)).toBe('light');
    expect(resolveAppTheme(null)).toBe('light');
  });
});

describe('persisted theme config', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults a fresh install to light', () => {
    expect(DEFAULT_CONFIG.theme).toBe('light');
    expect(loadConfig().theme).toBe('light');
  });

  it('preserves a persisted dark theme', () => {
    persist({ theme: 'dark', accentColor: '#4F46E5' });
    const config = loadConfig();
    expect(config.theme).toBe('dark');
    expect(config.accentColor).toBe('#4f46e5');
  });

  it('preserves a persisted system theme', () => {
    persist({ theme: 'system' });
    expect(loadConfig().theme).toBe('system');
  });
});

describe('applyAppearanceToDocument theme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--accent');
  });

  it('stamps data-theme=dark when asked', () => {
    applyAppearanceToDocument({ theme: 'dark', accentColor: '#059669' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('removes data-theme for system so prefers-color-scheme can apply', () => {
    stubSystemPrefersDark(true);
    document.documentElement.setAttribute('data-theme', 'light');
    applyAppearanceToDocument({ theme: 'system', accentColor: '#059669' });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('remaps near-panel accents to brand green in dark mode', () => {
    applyAppearanceToDocument({ theme: 'dark', accentColor: '#353535' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#87ea5c');
  });
});

describe('pre-hydration theme script', () => {
  const layoutPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../app/layout.tsx',
  );

  function runThemeInitScript(): void {
    const source = readFileSync(layoutPath, 'utf8');
    const match = /const themeInitScript = `([^`]*)`;/.exec(source);
    if (!match?.[1]) throw new Error('themeInitScript not found in app/layout.tsx');
    // eslint-disable-next-line no-new-func
    new Function(match[1])();
  }

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    store.clear();
  });

  it('paints dark before hydration when the stored theme is dark', () => {
    persist({ theme: 'dark' });
    runThemeInitScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('omits data-theme for system on a dark OS', () => {
    stubSystemPrefersDark(true);
    persist({ theme: 'system' });
    runThemeInitScript();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
