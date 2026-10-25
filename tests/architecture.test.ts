import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('architecture rules', () => {
  it('sim/ and domain/ never import pixi.js', () => {
    for (const f of [...files('src/sim'), ...files('src/domain')]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/from\s+['"]pixi\.js/);
    }
  });

  it('nondeterministic APIs are forbidden in sim/, domain/, core/, data/', () => {
    const banned = /Math\.random|Date\.now|performance\.now|new Date\(/;
    for (const f of [...files('src/sim'), ...files('src/domain'), ...files('src/core'), ...files('src/data')]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(banned);
    }
  });

  it('sim/ and domain/ do not import presentation/', () => {
    for (const f of [...files('src/sim'), ...files('src/domain')]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/presentation\//);
    }
  });
});
