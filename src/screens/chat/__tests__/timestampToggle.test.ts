/**
 * Why "hide timestamps" needed two fixes, and what each one holds.
 *
 * ## The prop
 *
 * It was `renderTime={show ? custom : undefined}`, which reads as "no time
 * renderer, so no time". GiftedChat's Bubble treats a falsy renderTime as "no
 * *custom* renderer" and supplies its own:
 *
 *   renderTime() {
 *     if (this.props.renderTime) return this.props.renderTime(timeProps)
 *     return <Time {...timeProps}/>          // node_modules/.../Bubble.js:223
 *   }
 *
 * So hiding left the default clock on screen.
 *
 * ## The row
 *
 * Fixing that alone changed nothing a user could see, which is how it came
 * back from a real device a second time. MessageContainer binds `renderRow`
 * once in its constructor and hands FlatList that one reference forever, and a
 * cell is a React.PureComponent whose props are `item`, `index`, `renderItem`,
 * `cellKey` and a few callbacks — `extraData` is not among them. A new
 * renderTime prop is therefore invisible to a row already on screen.
 *
 * The only lever is `item`. So the flag rides on the message and the renderer
 * reads it from there, which makes a row repaint because its own data changed.
 *
 * Reading the source rather than rendering a Bubble: gifted-chat's index pulls
 * a chain of untransformed ESM into jest, and widening transformIgnorePatterns
 * for it slows every other suite.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const SOURCE = readFileSync(join(__dirname, '..', 'ChatScreen.tsx'), 'utf8');

/**
 * Line comments removed, so an assertion about code is not satisfied — or
 * broken — by prose. The first draft of the "must not read the flag from
 * scope" case failed on a comment that mentioned the flag by name.
 */
function codeOnly(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

/** A whole `name={...}` prop, matched by brace counting. */
function prop(name: string): string {
  const start = SOURCE.indexOf(`${name}={`);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start + name.length + 1; i < SOURCE.length; i++) {
    if (SOURCE[i] === '{') depth++;
    else if (SOURCE[i] === '}') {
      depth--;
      if (depth === 0) return SOURCE.slice(start, i + 1);
    }
  }
  return '';
}

describe('the timestamp toggle', () => {
  it('has the two things it is guarding', () => {
    // Pinned first: both assertions below are about the contents of these, and
    // a rename or restructure must fail here rather than pass vacuously.
    expect(prop('renderTime')).toContain('<Time');
    expect(SOURCE).toContain('const filteredMessages = useMemo(');
  });

  it('always hands GiftedChat a function, so Bubble never supplies its own clock', () => {
    const renderTime = prop('renderTime');
    // No ternary on the flag and no undefined branch: either shape lets a
    // falsy renderTime through, and a falsy renderTime means the default Time.
    expect(codeOnly(renderTime)).not.toMatch(/:\s*undefined/);
    expect(codeOnly(renderTime)).not.toContain('showTimestamps');
    expect(renderTime).toMatch(/renderTime=\{\s*\(/);
  });

  it('decides from the row rather than from scope, and returns null to hide', () => {
    const renderTime = prop('renderTime');
    expect(renderTime).toContain('currentMessage?.showTime');
    expect(renderTime).toMatch(/return null/);
  });

  it('carries the flag on each message, which is the only thing a cell notices', () => {
    // Without this the prop is correct and the rows are stale — the state the
    // second report came from.
    expect(SOURCE).toContain('showTime: showTimestamps');
    // And the copy has to be keyed on the flag, or flipping it produces the
    // same item references and no row re-renders.
    const memo = SOURCE.slice(SOURCE.indexOf('const filteredMessages = useMemo('));
    const deps = memo.slice(memo.indexOf('}, ['), memo.indexOf(');', memo.indexOf('}, [')));
    expect(deps).toContain('showTimestamps');
  });
});
