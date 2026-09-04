import fs from 'fs';
import path from 'path';

/**
 * Nothing enforces direction-agnostic styles at the type level: marginLeft is
 * as valid a React Native style as marginStart, and the difference only shows
 * up on a device set to Arabic. So the guard is a test.
 *
 * `left`/`right` are deliberately *not* checked. Several are correct as they
 * stand — gifted-chat's bubble API uses `left`/`right` to mean incoming and
 * outgoing, `left: 0, right: 0` pairs stretch to full width in either
 * direction, and coordinates measured from the screen are already absolute.
 * A blanket rule would have to be suppressed in all of those places, which
 * teaches people to suppress it. Margins and paddings have no such exceptions.
 */
const BANNED = ['marginLeft', 'marginRight', 'paddingLeft', 'paddingRight'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('layout styles are direction-agnostic', () => {
  it('uses marginStart/marginEnd rather than Left/Right', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(__dirname, '..', '..'))) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const prop of BANNED) {
          if (new RegExp(`\\b${prop}\\s*:`).test(line)) {
            offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}  ${prop}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
