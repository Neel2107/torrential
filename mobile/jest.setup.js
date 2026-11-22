require('react-native-reanimated').setUpTests();

const { NativeModules } = require('react-native');

/** Gesture Handler 3 calls native methods that jest-expo's stand-in for its native module lacks. With no phone there is nothing for them to do, so each does nothing, and gestures render as they would before a touch. */
const gestureHandler = NativeModules.RNGestureHandlerModule;
for (const method of ['setGestureHandlerConfig', 'updateGestureHandlerConfig', 'configureRelations']) {
  gestureHandler[method] ??= () => {};
}
gestureHandler.installUIRuntimeBindings ??= () => true;

/** jest-expo's stand-in for expo-network's native module answers nothing; here the phone is on Wi‑Fi. */
const network = require('expo-network/build/ExpoNetwork').default;
network.getNetworkStateAsync = async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true });
network.addListener = () => ({ remove: () => {} });
