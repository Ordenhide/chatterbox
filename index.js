/**
 * @format
 */

import 'react-native-gesture-handler';
import './src/i18n';
import {enableScreens} from 'react-native-screens';
import {AppRegistry} from 'react-native';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';

enableScreens(true);

setBackgroundMessageHandler(getMessaging(), async _remoteMessage => {});

AppRegistry.registerComponent(appName, () => App);

