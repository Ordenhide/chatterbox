import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import ActionSheet, {type SheetAction} from '../ActionSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 34, left: 0, right: 0}),
}));

/** The real chat menu's length — the thing Alert.alert could not express. */
const FOURTEEN: SheetAction[] = Array.from({length: 14}, (_, i) => ({
  label: `Action ${i + 1}`,
  onPress: jest.fn(),
}));

function render(props: Partial<React.ComponentProps<typeof ActionSheet>> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <ActionSheet visible actions={FOURTEEN} onClose={jest.fn()} {...props} />,
    );
  });
  return tree;
}

function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter((child): child is string => typeof child === 'string');
}

/**
 * The pressable row whose own Text reads `label`.
 *
 * Matched on the row's Text being *exactly* that label rather than merely
 * containing it: the scrim is also a button and every label in the sheet is one
 * of its descendants, so a `some` match would silently select the scrim and
 * test dismissal instead of the action.
 */
function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const row = tree.root
    .findAll(node => node.props.accessibilityRole === 'button')
    .find(node => {
      const text = node.findAllByType(Text).map(t => t.props.children);
      return text.length === 1 && text[0] === label;
    });
  if (!row) throw new Error(`no pressable row labelled "${label}"`);
  act(() => {
    row.props.onPress();
  });
}

describe('ActionSheet', () => {
  // The regression this component exists for. React Native's Android Alert
  // maps buttons onto AlertDialog's three slots and drops the rest, so the
  // chat menu lost eleven of its fourteen actions with no error anywhere.
  test('renders every action, well past Alert.alert\'s three-button cap', () => {
    const rendered = labels(render());
    for (const {label} of FOURTEEN) {
      expect(rendered).toContain(label);
    }
    expect(rendered).toContain('Cancel');
  });

  test('closes before running the action, so a submenu is not presented under a dismissing sheet', () => {
    const order: string[] = [];
    const onClose = jest.fn(() => order.push('close'));
    const onPress = jest.fn(() => order.push('press'));
    const tree = render({
      actions: [{label: 'Reply', onPress: jest.fn()}, {label: 'Remind Me', onPress}],
      onClose,
    });

    press(tree, 'Remind Me');

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['close', 'press']);
  });

  test('renders nothing when closed', () => {
    const tree = render({visible: false});
    expect(labels(tree)).toHaveLength(0);
  });

  test('shows the title and message when given', () => {
    const rendered = labels(render({title: 'Message Actions', message: 'When?'}));
    expect(rendered).toContain('Message Actions');
    expect(rendered).toContain('When?');
  });
});
