import {afterEach, describe, expect, it} from 'vitest';
import {isOutside} from './useDismissOnOutside';

/**
 * Builds the shape the hook is designed around: one wrapper holding both the
 * trigger and the popover, with unrelated page content outside it.
 */
function buildMenu() {
  const page = document.createElement('div');
  const wrapper = document.createElement('div');
  const trigger = document.createElement('button');
  const menu = document.createElement('div');
  const menuItem = document.createElement('button');

  menu.appendChild(menuItem);
  wrapper.append(trigger, menu);

  const elsewhere = document.createElement('p');
  page.append(wrapper, elsewhere);
  document.body.appendChild(page);

  return {wrapper, trigger, menu, menuItem, elsewhere};
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isOutside', () => {
  it('reports a click on unrelated page content as outside', () => {
    const {wrapper, elsewhere} = buildMenu();
    expect(isOutside(elsewhere, wrapper)).toBe(true);
  });

  // The bug this hook exists to avoid: if the trigger counted as outside, then
  // pressing it while open would dismiss here and re-open via the trigger's own
  // toggle, leaving the menu apparently stuck.
  it('does not report the trigger as outside, so pressing it cannot self-dismiss', () => {
    const {wrapper, trigger} = buildMenu();
    expect(isOutside(trigger, wrapper)).toBe(false);
  });

  it('does not report the menu or its items as outside', () => {
    const {wrapper, menu, menuItem} = buildMenu();
    expect(isOutside(menu, wrapper)).toBe(false);
    expect(isOutside(menuItem, wrapper)).toBe(false);
  });

  // Text nodes are legitimate event targets; a press landing on a label inside
  // the menu must not read as outside just because it is not an Element.
  it('handles non-element nodes inside the container', () => {
    const {wrapper, menuItem} = buildMenu();
    const label = document.createTextNode('Delete chat');
    menuItem.appendChild(label);
    expect(isOutside(label, wrapper)).toBe(false);
  });

  it('treats a detached target as outside', () => {
    const {wrapper} = buildMenu();
    expect(isOutside(document.createElement('div'), wrapper)).toBe(true);
  });

  // Between opening and the ref attaching there is nothing to measure against;
  // answering "outside" there would close the menu the instant it appeared.
  it('never dismisses when there is no container yet', () => {
    const {elsewhere} = buildMenu();
    expect(isOutside(elsewhere, null)).toBe(false);
  });

  it('ignores targets that are not nodes at all', () => {
    const {wrapper} = buildMenu();
    expect(isOutside(null, wrapper)).toBe(false);
    expect(isOutside(new EventTarget(), wrapper)).toBe(false);
  });
});
