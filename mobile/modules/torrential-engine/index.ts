import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type TorrentialEngine = {
  port: number;
  start(): Promise<{ port: number; secret: string }>;
};

export const LocalEngine = requireOptionalNativeModule<TorrentialEngine>('TorrentialEngine');

export const CAN_RUN_LOCALLY = LocalEngine !== null && Platform.OS !== 'web';
