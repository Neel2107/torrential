import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, space, type } from '@/theme';

type Fit = 'content' | 'fill' | 'screen';

/**
 * The body of a form sheet: a heading, a scrolling middle that stays inside the sheet and above the keyboard,
 * and actions pinned below it so the submit button is never pushed out of reach.
 * `content` suits fit-to-content sheets, `fill` a sheet with a fixed height, `screen` a full screen.
 */
export function FormSheet({
  title,
  large = false,
  aside,
  actions,
  fit = 'content',
  children,
}: {
  title?: string;
  large?: boolean;
  aside?: ReactNode;
  actions?: ReactNode;
  fit?: Fit;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const sides = fit === 'screen' ? space.page : space.xl;
  const top = fit === 'screen' ? insets.top + space.xxl : space.xl;
  const bottom = insets.bottom + space.xl;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[fit === 'screen' ? styles.screen : styles.sheet, fit === 'content' ? styles.shrink : styles.fill]}
    >
      <ScrollView
        style={fit === 'content' ? styles.shrinkScroll : styles.fill}
        contentContainerStyle={[
          styles.body,
          { paddingHorizontal: sides, paddingTop: top, paddingBottom: actions ? 0 : bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {title ? (
          <View style={[styles.heading, aside ? styles.headingSpread : null]}>
            <Text style={[large ? type.display : type.title, styles.title]} accessibilityRole="header">
              {title}
            </Text>
            {aside}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {actions ? (
        <View style={[styles.actions, { paddingHorizontal: sides, paddingBottom: bottom }]}>{actions}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A form's problem, read out as soon as it shows. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <Text style={[type.label, { color: color.error }]} accessibilityLiveRegion="assertive">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: color.raised },
  screen: { backgroundColor: color.paper },
  shrink: { flexShrink: 1 },
  fill: { flex: 1 },
  shrinkScroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: space.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headingSpread: { justifyContent: 'space-between' },
  title: { flexShrink: 1, minWidth: 0 },
  actions: { paddingTop: space.lg, gap: space.lg },
});
