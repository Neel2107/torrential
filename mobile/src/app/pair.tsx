import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sentence } from '@web/lib/format';

import { EngineError } from '@/engine/client';
import { parsePairing, useSession } from '@/engine/session';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { Mark } from '@/ui/Mark';
import { color, font, radius, space, type } from '@/theme';

type Mode = 'scan' | 'type';

function explain(error: unknown): string {
  if (error instanceof EngineError) {
    if (error.status === 400) return 'That code is not the one your computer shows. Check it and try again.';
    if (error.status === 410) return 'That code has run out. Make a new one on your computer.';
    if (error.status === 429) return 'Too many tries. Wait a minute, then try again.';
    if (error.status === 404) return 'This phone is already paired with that computer.';
    return sentence(error.message);
  }
  return "Can't reach that address. Check that this phone is on the same network as the computer.";
}

export default function Pair() {
  const { pair, useLoopback } = useSession();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('scan');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const scanned = useRef(false);

  const attempt = async (base: string, pairingCode: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await pair(base, pairingCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setProblem(explain(error));
      scanned.current = false;
    } finally {
      setBusy(false);
    }
  };

  const onScan = (data: string) => {
    if (scanned.current || busy) return;
    const found = parsePairing(data);
    if (!found?.code) return;
    scanned.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    attempt(found.base, found.code);
  };

  const submit = () => {
    const found = parsePairing(address);
    const digits = code.replace(/\D/g, '');
    if (!found) return setProblem('Type the address your computer shows, such as mac.local or 192.168.1.20.');
    if (digits.length !== 6) return setProblem('The code has six digits.');
    attempt(found.base, digits);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Mark size={40} />
          <Text style={styles.wordmark}>torrential</Text>
        </View>
        <Text style={type.display}>Connect to your computer</Text>
        <Text style={type.body}>
          On the computer running torrential, open <Text style={styles.strong}>Devices</Text> and choose{' '}
          <Text style={styles.strong}>Add a device</Text>, or run{' '}
          <Text style={styles.code}>torrential devices add</Text>.
        </Text>

        {mode === 'scan' ? (
          <Scanner onScan={onScan} busy={busy} />
        ) : (
          <Typed {...{ address, setAddress, code, setCode, submit, busy }} />
        )}

        {problem ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.problem} accessibilityLiveRegion="assertive">
            <Icon name={icons.warning} size={18} tint={color.error} />
            <Text style={[type.label, { color: color.error, flex: 1 }]}>{problem}</Text>
          </Animated.View>
        ) : null}

        <Button
          kind="quiet"
          label={mode === 'scan' ? 'Type the address and code instead' : 'Scan the code instead'}
          onPress={() => {
            setProblem(null);
            setMode(mode === 'scan' ? 'type' : 'scan');
          }}
        />
        {__DEV__ ? <Button kind="quiet" label="Use the USB connection (development)" onPress={useLoopback} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Scanner({ onScan, busy }: { onScan: (data: string) => void; busy: boolean }) {
  const [permission, request] = useCameraPermissions();

  if (!permission) return <View style={styles.viewfinder} />;
  if (!permission.granted) {
    return (
      <View style={[styles.viewfinder, styles.center]}>
        <Icon name={icons.qr} size={40} tint={color.soft} />
        <Text style={[type.body, { textAlign: 'center' }]}>The camera reads the code on your computer's screen.</Text>
        <Button label="Allow the camera" onPress={request} />
      </View>
    );
  }
  return (
    <View style={styles.viewfinder}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <View style={styles.reticle} pointerEvents="none" />
      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: color.scrim }]}>
          <Text style={type.headline}>Pairing…</Text>
        </View>
      ) : null}
    </View>
  );
}

function Typed({
  address,
  setAddress,
  code,
  setCode,
  submit,
  busy,
}: {
  address: string;
  setAddress: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  submit: () => void;
  busy: boolean;
}) {
  const codeInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <View style={styles.form}>
      <Text style={type.label}>Address</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="mac.local or 192.168.1.20"
        placeholderTextColor={color.pencil}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="next"
        onSubmitEditing={() => codeInput.current?.focus()}
        style={styles.input}
        accessibilityLabel="Address of your computer"
      />
      <Text style={[type.label, { marginTop: space.md }]}>Code</Text>
      <TextInput
        ref={codeInput}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        placeholderTextColor={color.pencil}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={6}
        style={[styles.input, styles.codeInput]}
        accessibilityLabel="Six-digit code"
      />
      <Button label="Connect" onPress={submit} busy={busy} style={{ marginTop: space.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { paddingHorizontal: space.page, gap: space.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  wordmark: { ...type.title, letterSpacing: -0.6 },
  strong: { fontFamily: font.semibold, color: color.ink },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: color.ink, fontSize: 14 },
  viewfinder: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.raised,
    marginTop: space.sm,
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  reticle: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    right: '18%',
    bottom: '18%',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(240, 233, 220, 0.85)',
  },
  form: { gap: space.sm, marginTop: space.sm },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: color.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.ink,
    fontFamily: font.regular,
    fontSize: 17,
  },
  codeInput: { fontFamily: font.semibold, fontSize: 24, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  problem: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(226, 128, 110, 0.12)',
  },
});
