import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { EngineError } from '@/engine/client';
import { JobsProvider } from '@/engine/jobs';
import { SessionProvider, useSession } from '@/engine/session';
import { HERO, HeroLayer } from '@/ui/hero';
import { PortalHost } from '@/ui/Portal';
import { color } from '@/theme';

SplashScreen.preventAutoHideAsync();

AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: color.action,
    background: color.paper,
    card: color.paper,
    text: color.ink,
    border: color.rule,
    notification: color.action,
  },
};

function Routes() {
  const { session, forget } = useSession();
  // One cache per engine and pairing: nothing from a removed or different engine survives a new pairing.
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
    // A new engine key is the point: it throws the old cache away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineKey],
  );

  useEffect(() => {
    if (session.state !== 'loading') SplashScreen.hideAsync();
  }, [session.state]);

  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error') return;
        const error = event.action.error;
        if (error instanceof EngineError && error.unpaired) forget();
      }),
    [client, forget],
  );

  if (session.state === 'loading') return null;
  const paired = session.state === 'paired';

  return (
    <QueryClientProvider client={client}>
      <MaybeJobs paired={paired}>
        <Stack
          screenOptions={{
            headerShown: false,
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
            <Stack.Screen
              name="play"
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
                orientation: 'landscape',
                statusBarHidden: true,
                navigationBarHidden: true,
              }}
            />
            <Stack.Screen
              name="offline"
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
                orientation: 'landscape',
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
          <Stack.Protected guard={!paired}>
            <Stack.Screen name="pair" />
          </Stack.Protected>
        </Stack>
        <HeroLayer />
      </MaybeJobs>
    </QueryClientProvider>
  );
}

/** Every paired screen reads the one downloads stream: the tabs, the player and the title pages. */
function MaybeJobs({ paired, children }: { paired: boolean; children: ReactNode }) {
  return paired ? <JobsProvider>{children}</JobsProvider> : children;
}

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.paper }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <SessionProvider>
          <PortalHost>
            <Routes />
          </PortalHost>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
