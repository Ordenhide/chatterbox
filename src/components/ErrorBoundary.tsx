import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View, useColorScheme} from 'react-native';
import {getColors} from '../theme/colors';
import {reportError} from '../services/telemetry';
import {bodyWeight} from '../theme/typography';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches render-tree crashes anywhere below it so users see a recoverable
 * screen instead of the app going blank/red-screen. React error boundaries
 * only catch errors thrown during render/lifecycle, not inside async
 * callbacks or event handlers — those still need their own try/catch.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, `ErrorBoundary: ${info.componentStack}`);
  }

  handleReset = () => {
    this.setState({error: null});
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({onReset}: {onReset: () => void}) {
  const colors = getColors(useColorScheme());
  return (
    <View style={[styles.container, {backgroundColor: colors.backdrop}]}>
      <Text style={[styles.title, {color: colors.text}]}>Something went wrong</Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        The app hit an unexpected error. Your data is safe — try again.
      </Text>
      <TouchableOpacity
        style={[styles.button, {backgroundColor: colors.primary}]}
        onPress={onReset}
        accessibilityRole="button">
        <Text style={[styles.buttonText, {color: colors.textOnPrimary}]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontFamily: bodyWeight('700'),
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 2,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: bodyWeight('600'),
  },
});
