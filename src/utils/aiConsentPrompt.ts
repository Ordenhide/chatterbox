import {Alert} from 'react-native';
import {grantAiConsent} from '../services/aiConsent';

/**
 * Shows the AI disclosure and resolves to whether the user allowed it.
 *
 * A shared helper rather than an Alert inlined at each call site: the wording
 * is the disclosure, and three screens drifting apart on what they promise
 * about where messages go would be worse than no disclosure at all.
 *
 * Deliberately blunt — this is the one place the app's end-to-end encryption
 * is opened on purpose.
 */
export function promptAiConsent(t: (key: string) => string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(t('aiConsent.title'), t('aiConsent.body'), [
      {text: t('aiConsent.decline'), style: 'cancel', onPress: () => resolve(false)},
      {
        text: t('aiConsent.accept'),
        onPress: async () => {
          await grantAiConsent();
          resolve(true);
        },
      },
    ]);
  });
}
