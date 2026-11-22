import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type TorrentialEngine = {
  port: number;
  start(): Promise<{ port: number; secret: string }>;
  /** Android only: whether the engine starts with the app's process, before JavaScript asks. `start` turns it on. */
  startAtLaunch?(on: boolean): void;
};

export const LocalEngine = requireOptionalNativeModule<TorrentialEngine>('TorrentialEngine');

export const CAN_RUN_LOCALLY = LocalEngine !== null && Platform.OS !== 'web';
