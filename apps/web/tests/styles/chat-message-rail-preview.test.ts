import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const chatCss = readFileSync(new URL('../../src/styles/chat.css', import.meta.url), 'utf8');
const chatRootCss = readFileSync(
  new URL('../../src/components/chat/ChatRoot.module.css', import.meta.url),
  'utf8',
);

describe('chat message rail preview card', () => {
  it('right-aligns to the transcript and uses an opaque theme surface', () => {
    const previewRule = chatCss.match(/\.chat-message-rail__preview\s*\{([^}]*)\}/)?.[1];
    expect(previewRule).toBeTruthy();
    expect(previewRule).toMatch(/right:\s*16px;/);
    expect(previewRule).toMatch(/background:\s*var\(--chat-floating-card-bg\);/);
    expect(previewRule).toMatch(/color:\s*var\(--chat-floating-card-text\);/);
    expect(previewRule).not.toMatch(/linear-gradient|backdrop-filter/);

    // Light scope: app ground / strong ink (resolves to #fff / #202020).
    expect(chatRootCss).toMatch(
      /\.vars,\s*\n\.root \{[\s\S]*?--chat-floating-card-bg:\s*var\(--bg\);/,
    );
    expect(chatRootCss).toMatch(
      /\.vars,\s*\n\.root \{[\s\S]*?--chat-floating-card-text:\s*var\(--text-strong\);/,
    );
    // Dark scope: elevated panel so the composer is not a white island.
    expect(chatRootCss).toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-floating-card-bg:\s*var\(--bg-elevated\);/,
    );
    expect(chatRootCss).toMatch(
      /:global\(\[data-theme='dark'\]\)[\s\S]*?--chat-floating-card-text:\s*var\(--text-strong\);/,
    );
    expect(chatRootCss).not.toMatch(/--chat-floating-card-bg:\s*#fff;/);
  });
});
