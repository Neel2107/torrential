import { Link, router } from 'expo-router';
import { createContext, use, type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { usePrefetchTitle } from '@/engine/queries';
import { mark } from '@/perf';

import { HERO, useHeroSource } from './hero';
import { Tap } from './Tap';

const Source = createContext<ReturnType<typeof useHeroSource>['ref'] | null>(null);

/** A press that opens a title's page, flying the poster marked with `TitlePoster` into it. */
export function TitleTap({
  id,
  onOpen,
  onPressIn,
  children,
  ...tap
}: Omit<ComponentProps<typeof Tap>, 'onPress'> & { id: string; onOpen?: () => void; children: ReactNode }) {
  const { ref, open } = useHeroSource(id);
  const prefetch = usePrefetchTitle();
  const href = { pathname: '/title/[id]', params: { id } } as const;

  const press = (
    <Tap
      {...tap}
      onPressIn={(event) => {
        prefetch(id);
        onPressIn?.(event);
      }}
      onPress={
        HERO
          ? () => {
              mark('open');
              onOpen?.();
              open(() => router.navigate(href));
            }
          : undefined
      }
    >
      <Source value={ref}>{children}</Source>
    </Tap>
  );

  if (HERO) return press;

  return (
    <Link href={href} onPress={onOpen} asChild>
      {press}
    </Link>
  );
}

export function TitlePoster({ children }: { children: ReactNode }) {
  const ref = use(Source);

  if (!ref) return children;

  return (
    <Link.AppleZoom>
      <View ref={ref} collapsable={false}>
        {children}
      </View>
    </Link.AppleZoom>
  );
}
