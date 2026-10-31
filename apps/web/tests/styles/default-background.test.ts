import { describe, expect, it } from 'vitest';
import { readExpandedIndexCss } from '../helpers/read-expanded-css';

const indexCss = readExpandedIndexCss();

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(indexCss);
  if (!match) throw new Error(`Missing CSS block for ${selector}`);
  return match[1] ?? '';
}

describe('default app background colors', () => {
  it('uses the release light background color by default', () => {
    const root = cssBlock(':root');

    expect(root).toContain('--bg: #fff;');
    expect(root).toContain('--bg-app: #fff;');
  });

  it('keeps the dark theme on the stepped surface ladder ground', () => {
    const dark = cssBlock('[data-theme="dark"]');

    // Proper dark pass: ground lifts off crushed #202020 so elevated chrome
    // (composer / primary) can step up without looking like white islands.
    expect(dark).toContain('--bg: #242424;');
    expect(dark).toContain('--bg-app: #242424;');
  });

  it('prefers platform UI fonts over optional local app fonts', () => {
    const root = cssBlock(':root');
    const sans = /--sans:\s*([^;]+);/.exec(root)?.[1];

    expect(sans).toBeDefined();
    expect(sans).toContain('"Albert Sans"');
    expect(sans).not.toContain("'Inter'");
    expect(sans).toMatch(/"Albert Sans", "PingFang SC", "Microsoft YaHei"/);
  });
});
