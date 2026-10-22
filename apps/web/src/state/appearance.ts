import { getOpenDesignHost } from '@open-design/host';
import type { AppTheme } from '../types';

const ACCENT_VARS = [
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--accent-tint',
  '--accent-hover',
] as const;

/** Near-panel neutrals that disappear on dark surfaces — remap to brand green. */
const DARK_INVISIBLE_ACCENTS = new Set(['#353535', '#202020', '#848484']);
const DARK_SAFE_ACCENT = '#87ea5c';

export const DEFAULT_ACCENT_COLOR = '#353535';
export const ACCENT_SWATCHES = [
  DEFAULT_ACCENT_COLOR,
  '#202020',
  '#848484',
  '#87ea5c',
  '#0d5400',
  '#1A74FF',
  '#FFBA12',
  '#FF7528',
  '#F04142',
] as const;

export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function resolveAccentColor(value: unknown): string {
  return normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR;
}

/**
 * Accept light / dark / system; anything else falls back to light.
 */
export function resolveAppTheme(persisted?: AppTheme | null): AppTheme {
  if (persisted === 'light' || persisted === 'dark' || persisted === 'system') {
    return persisted;
  }
  return 'light';
}

export function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Whether the resolved appearance paints dark surfaces right now. */
export function isDarkAppearance(theme: AppTheme | null | undefined): boolean {
  const resolved = resolveAppTheme(theme);
  if (resolved === 'dark') return true;
  if (resolved === 'light') return false;
  return prefersDarkColorScheme();
}

function accentForTheme(accentColor: string, dark: boolean): string {
  if (dark && DARK_INVISIBLE_ACCENTS.has(accentColor)) return DARK_SAFE_ACCENT;
  return accentColor;
}

function accentVars(accentColor: string): Record<(typeof ACCENT_VARS)[number], string> {
  return {
    '--accent': accentColor,
    // Keep these mix ratios in sync with the pre-hydration script in app/layout.tsx.
    '--accent-strong': `color-mix(in srgb, ${accentColor} 82%, var(--text-strong))`,
    '--accent-soft': `color-mix(in srgb, ${accentColor} 12%, var(--bg-subtle))`,
    '--accent-tint': `color-mix(in srgb, ${accentColor} 6%, var(--bg-panel))`,
    '--accent-hover': `color-mix(in srgb, ${accentColor} 86%, var(--text-strong))`,
  };
}

export function applyAppearanceToDocument({
  theme,
  accentColor,
}: {
  theme?: AppTheme;
  accentColor?: string;
}): void {
  const root = document.documentElement;
  const resolved = resolveAppTheme(theme);
  if (resolved === 'light' || resolved === 'dark') {
    root.setAttribute('data-theme', resolved);
  } else {
    // System mode: omit the attribute so CSS `prefers-color-scheme` applies.
    root.removeAttribute('data-theme');
  }

  const dark = isDarkAppearance(resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#2a2a2a' : '#f7f7f7');

  // Desktop shell: keep the native window appearance (the macOS vibrancy
  // glass material) in step with the app theme. Without this the glass
  // follows the OS appearance, so an explicitly light app over a dark OS sat
  // on dark glass and read as a muddy gray (#94). Feature-detected — browsers
  // and older host builds have no appearance capability.
  getOpenDesignHost()?.appearance?.setTheme(
    resolved === 'light' || resolved === 'dark' ? resolved : 'system',
  );

  const normalized = accentForTheme(resolveAccentColor(accentColor), dark);
  const vars = accentVars(normalized);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
