import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/** torrential's engine running inside this app, on loopback. Missing on builds without the native module. */
type TorrentialEngine = {
  port: number;
  /** Starts the engine if it is not running, and answers with its port. */
  start(): Promise<number>;
};

export const LocalEngine = requireOptionalNativeModule<TorrentialEngine>('TorrentialEngine');

/** Whether this build can run the engine on the phone. */
export const CAN_RUN_LOCALLY = LocalEngine !== null && Platform.OS !== 'web';
