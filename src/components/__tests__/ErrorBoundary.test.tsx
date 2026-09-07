import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import ErrorBoundary from '../ErrorBoundary';

jest.mock('../../services/errorLog', () => ({
  reportError: jest.fn(),
}));

function Bomb(): React.JSX.Element {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  test('renders children when there is no error', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ErrorBoundary>
          <Text>hello</Text>
        </ErrorBoundary>,
      );
    });
    expect(tree!.toJSON()).toBeTruthy();
  });

  test('shows a fallback screen instead of crashing when a child throws', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let tree: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      );
    });
    const json = tree!.toJSON();
    expect(json).toBeTruthy();
    // The key, not the sentence: the fallback speaks through the dictionary
    // now, and i18next is not initialised in the test environment, so `t`
    // returns what it was asked for.
    expect(JSON.stringify(json)).toContain('errorBoundary.title');
    consoleError.mockRestore();
  });
});
