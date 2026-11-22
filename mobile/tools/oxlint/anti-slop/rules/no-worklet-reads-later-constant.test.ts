import { RuleTester } from "oxlint/plugins-dev";

import { noWorkletReadsLaterConstantRule } from "./no-worklet-reads-later-constant.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const later = { messageId: "later" };

tester.run("anti-slop/no-worklet-reads-later-constant", noWorkletReadsLaterConstantRule, {
  valid: [
    "const RANGE = [0, 1];\nfunction Flying() { useAnimatedStyle(() => ({ opacity: interpolate(p.get(), RANGE, [0, 1]) })); }",
    "function Card() { return <View style={styles.card} />; }\nconst styles = StyleSheet.create({ card: {} });",
    "function Card() { const range = [0, 1]; useAnimatedStyle(() => ({ opacity: range[0] })); }",
    "function Card() { useAnimatedStyle(() => ({ opacity: shown.get() ? 1 : 0, transform: [{ scale: 1 }] })); }\nconst other = 1;",
    "function Card() { useAnimatedStyle(() => ({ width: box.width })); }\nconst width = 3;",
  ],
  invalid: [
    {
      name: "the crash: a range declared below the component",
      code: "function Flying() { useAnimatedStyle(() => ({ opacity: interpolate(p.get(), RING_IN, [0, 1]) })); }\nconst RING_IN = [0.6, 1];",
      errors: [later],
    },
    {
      name: "a timing config below a derived value",
      code: "function Fill() { useDerivedValue(() => withTiming(target, GLIDE)); }\nconst GLIDE = { duration: 260 };",
      errors: [later],
    },
    {
      name: "a worklet function reading a later constant",
      code: "function band(p) { 'worklet'; return p * SCALE; }\nconst SCALE = 2;",
      errors: [later],
    },
  ],
});
