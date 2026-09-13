/**
 * "Hide timestamps" has to render nothing, and `undefined` does not.
 *
 * GiftedChat's Bubble treats a falsy `renderTime` as "no *custom* renderer",
 * not as "no time":
 *
 *   renderTime() {
 *     if (this.props.renderTime) return this.props.renderTime(timeProps);
 *     return <Time {...timeProps}/>;        // node_modules/.../Bubble.js:223
 *   }
 *
 * So `renderTime={show ? custom : undefined}` left GiftedChat's own clock on
 * screen whenever the user asked for it to go away. The toggle changed the
 * timestamp's font and margins and nothing else, which is why it came back
 * from a real device as "显示和隐藏时间戳不好使" rather than as a visible fault.
 *
 * Rendering Bubble here would be the more direct test, but it drags a chain of
 * untransformed ESM dependencies into jest and the transform config change
 * costs every other suite. This reads the source instead — and, per the rule
 * for any guard that scans source, first proves it found the thing it claims
 * to be guarding.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const SOURCE = readFileSync(join(__dirname, '..', 'ChatScreen.tsx'), 'utf8');

/** The full `renderTime={...}` expression, matched by brace counting. */
function renderTimeProp(): string {
  const start = SOURCE.indexOf('renderTime={');
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + 'renderTime='.length; i < SOURCE.length; i++) {
    const c = SOURCE[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return SOURCE.slice(start, i + 1);
    }
  }
  return '';
}

describe('the timestamp toggle', () => {
  it('has a renderTime prop to guard at all', () => {
    // Pinned first: a refactor that renames or restructures this prop must
    // fail loudly here rather than make every assertion below vacuous.
    const prop = renderTimeProp();
    expect(prop).not.toBe('');
    expect(prop).toContain('showTimestamps');
    expect(prop).toContain('<Time');
  });

  it('renders nothing when hidden, rather than falling back to the default clock', () => {
    const prop = renderTimeProp();
    // The exact regression: a bare `undefined` branch hands GiftedChat its own
    // <Time /> and the toggle stops doing anything.
    expect(prop).not.toMatch(/:\s*undefined/);
    expect(prop).toMatch(/\(\s*\)\s*=>\s*null/);
  });
});
