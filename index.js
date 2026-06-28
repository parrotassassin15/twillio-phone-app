/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { initCrashReporter } from './src/services/crashReporter';

initCrashReporter();
AppRegistry.registerComponent(appName, () => App);
