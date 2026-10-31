import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const chatRootCss = readFileSync(
  new URL('../../src/components/chat/ChatRoot.module.css', import.meta.url),
  'utf8',
);
const primitivesCss = readFileSync(
  new URL('../../src/styles/primitives.css', import.meta.url),
  'utf8',
);
const mentionHomeCss = readFileSync(
  new URL('../../src/styles/workspace/mention-home.css', import.meta.url),
  'utf8',
);
const routinesCss = readFileSync(
  new URL('../../src/styles/viewer/routines.css', import.meta.url),
  'utf8',
);
const designFilesCss = readFileSync(
  new URL('../../src/styles/workspace/design-files.css', import.meta.url),
  'utf8',
);
const pluginsHomeCss = readFileSync(
  new URL('../../src/styles/home/plugins-home.css', import.meta.url),
  'utf8',
);

function darkThemeBlock(source: string): string {
  const match = source.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
  const block = match?.[1];
  expect(block).toBeTruthy();
  return block as string;
}

function systemDarkBlock(source: string): string {
  const match = source.match(
    /@media \(prefers-color-scheme: dark\) \{\s*html:not\(\[data-theme\]\) \{([\s\S]*?)\n {2}\}/,
  );
  const block = match?.[1];
  expect(block).toBeTruthy();
  return block as string;
}

/** Relative luminance (sRGB), WCAG 2.x. */
function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const n = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const channels = [0, 2, 4].map((i) => {
    const v = Number.parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function tokenHex(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8});`));
  const hex = match?.[1];
  expect(hex, `missing hex for ${name}`).toBeTruthy();
  return (hex as string).toLowerCase();
}

describe('complete dark theme — token + surface seams', () => {
  it('remaps select/selected/tick ink in both dark scopes', () => {
    for (const block of [darkThemeBlock(tokensCss), systemDarkBlock(tokensCss)]) {
      expect(block).toMatch(/--select-ink:\s*#f8f9fa;/);
      expect(block).toMatch(/--selected:\s*#f8f9fa;/);
      expect(block).toMatch(/--selected-soft:\s*color-mix\(in srgb, #f8f9fa 16%, transparent\);/);
      expect(block).toMatch(/--tick-img:\s*url\("data:image\/svg\+xml;base64,/);
      expect(block).not.toMatch(/--select-ink:\s*#353535;/);
    }
  });

  it('keeps a stepped dark surface ladder (ground < panel ≤ elevated)', () => {
    for (const block of [darkThemeBlock(tokensCss), systemDarkBlock(tokensCss)]) {
      const bg = tokenHex(block, '--bg');
      const panel = tokenHex(block, '--bg-panel');
      const elevated = tokenHex(block, '--bg-elevated');
      expect(relativeLuminance(panel)).toBeGreaterThan(relativeLuminance(bg));
      expect(relativeLuminance(elevated)).toBeGreaterThan(relativeLuminance(panel));
      // Composer / floating cards sit on elevated — must not equal crushed ground.
      expect(elevated).not.toBe(bg);
    }
  });

  it('keeps WCAG-ish body and soft text contrast on dark ground', () => {
    for (const block of [darkThemeBlock(tokensCss), systemDarkBlock(tokensCss)]) {
      const bg = tokenHex(block, '--bg');
      const text = tokenHex(block, '--text');
      const soft = tokenHex(block, '--text-soft');
      const faint = tokenHex(block, '--text-faint');
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(soft, bg)).toBeGreaterThanOrEqual(4.5);
      // Faint is captions; allow AA large-text floor (3:1) but keep well above fail.
      expect(contrastRatio(faint, bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps Plan current step readable in dark chat', () => {
    expect(chatRootCss).toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-plan-current-text:\s*var\(--text\);/,
    );
    expect(chatRootCss).not.toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-plan-current-text:\s*#353535;/,
    );
  });

  it('maps dark stream/tool ink through muted text (not #a3a3a3)', () => {
    expect(chatRootCss).toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-stream-ink:\s*var\(--text-muted\);/,
    );
    expect(chatRootCss).toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-tool-ink:\s*var\(--text-muted\);/,
    );
  });

  it('routes primary buttons through theme tokens (no hardcoded #353535 hover)', () => {
    expect(primitivesCss).toMatch(
      /button\.primary \{[\s\S]*?background:\s*var\(--button-primary-bg\);/,
    );
    expect(primitivesCss).toMatch(
      /button\.primary:hover:not\(:disabled\) \{[\s\S]*?background:\s*var\(--button-primary-hover-bg\);/,
    );
    expect(primitivesCss).not.toMatch(
      /button\.primary:hover:not\(:disabled\) \{[\s\S]*?background:\s*#353535;/,
    );
  });

  it('flips primary CTA tokens to elevated + strong ink in dark scopes', () => {
    for (const block of [darkThemeBlock(tokensCss), systemDarkBlock(tokensCss)]) {
      expect(block).toMatch(/--button-primary-bg:\s*var\(--bg-elevated\);/);
      expect(block).toMatch(/--button-primary-ink:\s*var\(--text-strong\);/);
      expect(block).not.toMatch(/--button-primary-bg:\s*var\(--text-strong\);/);
    }
  });

  it('keeps settings active nav on elevated + strong ink', () => {
    expect(mentionHomeCss).toMatch(
      /\.settings-page-shell \.settings-nav-item\.active,[\s\S]*?background:\s*var\(--bg-elevated\);/,
    );
    expect(mentionHomeCss).toMatch(
      /\.settings-page-shell \.settings-nav-item\.active,[\s\S]*?color:\s*var\(--text-strong\);/,
    );
  });

  it('uses theme tokens for project conversation chrome that used to be white', () => {
    expect(routinesCss).toMatch(
      /\.workspace-shell \.workspace-tab\.is-active \{[\s\S]*?background:\s*var\(--bg\);/,
    );
    expect(routinesCss).toMatch(/\.app \.df-panel,[\s\S]*?background:\s*var\(--bg\);/);
    expect(designFilesCss).toMatch(/\.df-empty \{[\s\S]*?background-color:\s*var\(--bg\);/);
    expect(designFilesCss).toMatch(/\.df-card \{[\s\S]*?background:\s*var\(--bg\);/);
    expect(pluginsHomeCss).toMatch(
      /\.plugins-home__action--primary \{[\s\S]*?background:\s*var\(--bg-elevated\);/,
    );
    expect(pluginsHomeCss).not.toMatch(
      /\.plugins-home__action--primary \{[\s\S]*?background:\s*white;/,
    );
  });
});
