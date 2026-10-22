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
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

function systemDarkBlock(source: string): string {
  const match = source.match(
    /@media \(prefers-color-scheme: dark\) \{\s*html:not\(\[data-theme\]\) \{([\s\S]*?)\n {2}\}/,
  );
  expect(match?.[1]).toBeTruthy();
  return match![1];
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

  it('keeps Plan current step readable in dark chat', () => {
    expect(chatRootCss).toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-plan-current-text:\s*var\(--text\);/,
    );
    expect(chatRootCss).not.toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-plan-current-text:\s*#353535;/,
    );
  });

  it('does not snap primary hover to hardcoded #353535', () => {
    expect(primitivesCss).toMatch(
      /button\.primary:hover:not\(:disabled\) \{[\s\S]*?color-mix\(in srgb, var\(--text-strong\) 88%, var\(--bg\)\)/,
    );
    expect(primitivesCss).not.toMatch(
      /button\.primary:hover:not\(:disabled\) \{[\s\S]*?background:\s*#353535;/,
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
