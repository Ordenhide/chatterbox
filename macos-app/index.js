/**
 * @format
 *
 * The macOS entry point, separate from the root ../index.js on purpose.
 *
 * The root entry imports two packages that ../react-native.config.js lists as
 * having no macOS support — `@react-native-firebase/messaging` and
 * `react-native-screens` — and calls into both at module scope
 * (setBackgroundMessageHandler, enableScreens). Autolinking is disabled for
 * them on macOS, so those calls hit modules that were never linked and the app
 * fails before it renders. This entry simply does not make them.
 *
 * The registered name is lowercase `chatterbox` to match
 * macos/chatterbox-macOS/AppDelegate.mm, which sets
 * `self.moduleName = @"chatterbox"`. The root app.json registers "Chatterbox",
 * and AppRegistry lookups are case-sensitive — so the two never agreed.
 */
import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import '../src/i18n';
import {AppRegistry} from 'react-native';
import App from '../App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
