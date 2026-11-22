import { Button as NativeButton, Host, Image as SwiftImage, Menu as NativeMenu } from '@expo/ui/swift-ui';
import * as modifiers from '@expo/ui/swift-ui/modifiers';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Menu } from '../../modules/glass-menu-android';

import { color, scheme, space, type } from '@/theme';

import { ask, type Question } from './Ask';
import { Icon, icons } from './Icon';
import { ActionRow } from './Row';
import { Sheet } from './Sheet';

/** Something a row's menu can do. `ask` makes it confirm first; `symbol` is its SF Symbol in the iOS menu. */
export type RowAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  symbol: SFSymbol;
  danger?: boolean;
  ask?: Question;
  run: () => void | Promise<void>;
};

/** Runs an action, asking first when it says to. */
export async function runAction(action: RowAction) {
  if (!action.ask || (await ask(action.ask))) await action.run();
}

/** The ··· on a row: the system menu on iOS, the glass menu on Android, both from the same actions. */
export function MoreMenu({ actions, label }: { actions: RowAction[]; label: string }) {
  if (Platform.OS === 'ios') {
    return (
      <Host matchContents>
        <NativeMenu
          label={
            <SwiftImage
              systemName="ellipsis"
              size={18}
              color={color.pencil}
              modifiers={[
                modifiers.frame({ width: 44, height: 44 }),
                modifiers.contentShape(modifiers.shapes.rectangle()),
              ]}
            />
          }
        >
          {actions.map((action) => (
            <NativeButton
              key={action.id}
              label={action.label}
              systemImage={action.symbol}
              role={action.danger ? 'destructive' : 'default'}
              onPress={() => runAction(action)}
            />
          ))}
        </NativeMenu>
      </Host>
    );
  }

  return (
    <Menu
      colorScheme={scheme}
      onSelect={({ id }) => {
        const action = actions.find((candidate) => candidate.id === id);

        if (action) runAction(action);
      }}
    >
      <Menu.Trigger glass={false} accessibilityLabel={label} style={styles.target}>
        <Icon name={icons.more} size={20} tint={color.pencil} />
      </Menu.Trigger>
      <Menu.Content fontFamily="Inter_500Medium">
        {actions.map((action) => (
          <Menu.Item key={action.id} id={action.id} destructive={action.danger}>
            <Menu.Item.Icon>{({ color: tint }) => <Icon name={action.icon} size={20} tint={tint} />}</Menu.Item.Icon>
            <Menu.Item.Title>{action.label}</Menu.Item.Title>
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu>
  );
}

/** The same actions as a sheet, for a long press on the row. */
export function ActionSheet({ title, actions, onClose }: { title: string; actions: RowAction[]; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  return (
    <Sheet
      onClose={onClose}
      render={(close) => (
        <View style={styles.sheet}>
          <Text style={[type.headline, styles.title]} numberOfLines={2}>
            {title}
          </Text>
          {actions.map((action) => (
            <ActionRow
              key={action.id}
              icon={action.icon}
              label={action.label}
              danger={action.danger}
              disabled={busy}
              onPress={() => {
                setBusy(true);
                close(() => runAction(action));
              }}
            />
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  target: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheet: { paddingHorizontal: space.xl, gap: space.xs },
  title: { marginBottom: space.md },
});
