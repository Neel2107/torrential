import { RuleTester } from "oxlint/plugins-dev";

import { noJsCallInWorkletRule } from "./no-js-call-in-worklet.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const plain = { messageId: "plain" };
const imported = { messageId: "imported" };

const meterBeforeTheFix = `
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme';

function clamp(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function EasedFill({ fraction }: { fraction: number }) {
  const value = useDerivedValue(() => withTiming(clamp(fraction), { duration: motion.tick, easing: Easing.linear }));
  const scale = useAnimatedStyle(() => ({ transform: [{ scaleX: value.get() }] }));

  return <Animated.View style={scale} />;
}
`;

const meterToday = `
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme';

function clamp(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function EasedFill({ fraction }: { fraction: number }) {
  const target = clamp(fraction);
  const value = useDerivedValue(() => withTiming(target, { duration: motion.tick, easing: Easing.linear }));
  const scale = useAnimatedStyle(() => ({ transform: [{ scaleX: value.get() }] }));

  return <Animated.View style={scale} />;
}
`;

tester.run("anti-slop/no-js-call-in-worklet", noJsCallInWorkletRule, {
  valid: [
    meterToday,
    "function clamp(x) { 'worklet'; return x; } useDerivedValue(() => withTiming(clamp(f)));",
    "const clamp = (x) => { 'worklet'; return x; }; useDerivedValue(() => clamp(f));",
    "import { clamp, interpolate } from 'react-native-reanimated'; useDerivedValue(() => interpolate(clamp(f, 0, 1), [0, 1], [0, 9]));",
    "import { scheduleOnRN } from 'react-native-worklets'; useAnimatedReaction(() => v.get(), (n) => { if (n > 1) scheduleOnRN(tell, n); });",
    "useAnimatedStyle(() => ({ opacity: Math.min(1, v.get()), width: [1, 2].map((x) => x * 2)[0] }));",
    "useAnimatedStyle(() => { const half = (x) => x / 2; return { opacity: half(v.get()) }; });",
    "useAnimatedReaction(() => v.get(), (now, before) => { if (before !== null) offset.set(now - before); });",
    "import * as Haptics from 'expo-haptics'; usePanGesture({ runOnJS: true, onEnd: () => { Haptics.selectionAsync(); } });",
    "function clamp(x) { return x; } function onPress() { clamp(1); }",
    "function clamp(x) { return x; } useEffect(() => { clamp(1); });",
  ],
  invalid: [
    { code: meterBeforeTheFix, errors: [plain] },
    { code: "function Probe({ onDone }) { v.set(withTiming(1, {}, () => { onDone(); })); }", errors: [plain] },
    {
      code: "const [open, setOpen] = useState(false); useAnimatedReaction(() => v.get(), (n) => { if (n > 1) setOpen(true); });",
      errors: [plain],
    },
    {
      code: "const tell = useCallback(() => {}, []); useAnimatedReaction(() => v.get(), (n) => { if (n) tell(); });",
      errors: [plain],
    },
    {
      code: "function half(x) { return x / 2; } useAnimatedStyle(() => ({ width: [1].map((x) => half(x))[0] }));",
      errors: [plain],
    },
    {
      code: "function half(x) { return x / 2; } function step() { 'worklet'; return half(1); }",
      errors: [plain],
    },
    {
      code: "import * as Haptics from 'expo-haptics'; usePanGesture({ onEnd: () => { Haptics.selectionAsync(); } });",
      errors: [imported],
    },
    {
      code: "import { lerp } from 'some-math'; useAnimatedStyle(() => ({ opacity: lerp(0, 1, v.get()) }));",
      errors: [imported],
    },
    {
      code: "import { alpha } from '@/theme'; useAnimatedStyle(() => ({ backgroundColor: alpha(ink, v.get()) }));",
      errors: [imported],
    },
  ],
});
