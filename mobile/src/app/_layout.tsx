import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { EngineError } from '@/engine/client';
import { JobsProvider } from '@/engine/jobs';
import { SessionProvider, useSession } from '@/engine/session';
import { HERO, HeroLayer } from '@/ui/hero';
import { AskHost } from '@/ui/Ask';
import { FONTS } from '@/fonts';
import { PortalHost } from '@/ui/Portal';
import { color, scheme, stage } from '@/theme';

SplashScreen.preventAutoHideAsync();

Appearance.setColorScheme(scheme);

SystemUI.setBackgroundColorAsync(color.paper);

AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

const theme = {
  ...base,
  colors: {
    ...base.colors,
    primary: color.action,
    background: color.paper,
    card: color.paper,
    text: color.ink,
    border: color.rule,
    notification: color.action,
  },
};

export const unstable_settings = { anchor: '(tabs)' };

function Routes() {
  const { session, forget } = useSession();
  const engineKey = session.state === 'paired' ? `${session.link.base}|${session.link.token ?? ''}` : 'unpaired';

  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            retry: (count, error) => !(error instanceof EngineError && error.unpaired) && count < 2,
          },
        },
      }),
    [engineKey],
  );

  useEffect(() => {
    if (session.state !== 'loading') SplashScreen.hideAsync();
  }, [session.state]);

  const engineId = session.state === 'paired' ? session.engine.id : null;
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error' || !engineId) return;
        const error = event.action.error;

        if (error instanceof EngineError && error.unpaired) forget(engineId);
      }),
    [client, forget, engineId],
  );

  if (session.state === 'loading') return null;
  const paired = session.state === 'paired';

  return (
    <QueryClientProvider client={client}>
      <MaybeJobs key={engineKey} paired={paired}>
        <PortalHost>
          <Stack
            screenOptions={{
              headerShown: false,
              statusBarStyle: scheme === 'dark' ? 'light' : 'dark',
              orientation: 'portrait_up',
              contentStyle: { backgroundColor: color.paper },
            }}
          >
            <Stack.Protected guard={paired}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="title/[id]"
                options={
                  HERO
                    ? {
                        presentation: 'transparentModal',
                        animation: 'none',
                        contentStyle: { backgroundColor: 'transparent' },
                      }
                    : { animation: 'slide_from_right' }
                }
              />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen
                name="play"
                options={{
                  presentation: 'fullScreenModal',
                  animation: 'fade',
                  orientation: 'landscape',
                  contentStyle: { backgroundColor: stage.paper },
                  statusBarHidden: true,
                  navigationBarHidden: true,
                }}
              />
              <Stack.Screen
                name="tv"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.92],
                  sheetCornerRadius: 28,
                }}
              />
              <Stack.Screen
                name="add"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: 'fitToContents',
                  sheetCornerRadius: 28,
                }}
              />
              <Stack.Screen
                name="engine"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: 'fitToContents',
                  sheetCornerRadius: 28,
                }}
              />
              <Stack.Screen
                name="relocate"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: 'fitToContents',
                  sheetCornerRadius: 28,
                }}
              />
            </Stack.Protected>
            <Stack.Screen name="pair" />
            <Stack.Screen
              name="offline"
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
                orientation: 'landscape',
                contentStyle: { backgroundColor: stage.paper },
                statusBarHidden: true,
                navigationBarHidden: true,
              }}
            />
            <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <HeroLayer />
          <AskHost />
        </PortalHost>
      </MaybeJobs>
    </QueryClientProvider>
  );
}

function MaybeJobs({ paired, children }: { paired: boolean; children: ReactNode }) {
  return paired ? <JobsProvider>{children}</JobsProvider> : children;
}

export default function RootLayout() {
  const [loaded] = useFonts(FONTS);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.paper }}>
      <ThemeProvider value={theme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <SessionProvider>
          <Routes />
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
