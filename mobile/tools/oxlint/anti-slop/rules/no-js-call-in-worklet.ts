import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { resolveVariable } from "../shared/scope.ts";

import type { ESTree } from "@oxlint/plugins";

type WorkletFunction = ESTree.Function | ESTree.ArrowFunctionExpression;

/** The calls whose arguments at these positions Reanimated turns into worklets. */
const WORKLET_ARGUMENTS = new Map<string, number[]>([
  ["useAnimatedStyle", [0]],
  ["useAnimatedProps", [0]],
  ["useDerivedValue", [0]],
  ["useAnimatedReaction", [0, 1]],
  ["useAnimatedScrollHandler", [0]],
  ["useFrameCallback", [0]],
  ["runOnUI", [0]],
  ["scheduleOnUI", [0]],
  ["withTiming", [2]],
  ["withSpring", [2]],
  ["withDecay", [1]],
  ["withRepeat", [3]],
]);

/** Gesture Handler 3's hooks (`usePanGesture`, `useTapGesture`, …), whose callbacks run on the UI thread unless `runOnJS: true`. */
const GESTURE_HOOK = /^use[A-Z][A-Za-z]*Gesture$/;

const WORKLET_MODULES = new Set(["react-native-reanimated", "react-native-worklets"]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function isFunction(node: ESTree.Node | null | undefined): node is WorkletFunction {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionExpression" ||
    node?.type === "FunctionDeclaration"
  );
}

function hasWorkletDirective(fn: WorkletFunction): boolean {
  if (fn.body?.type !== "BlockStatement") return false;
  const first = fn.body.body[0];

  return first?.type === "ExpressionStatement" && "directive" in first && first.directive === "worklet";
}

function projectRoot(file: string): string | null {
  for (let directory = dirname(file); directory !== dirname(directory); directory = dirname(directory)) {
    if (existsSync(join(directory, "package.json"))) return directory;
  }

  return null;
}

function moduleFile(fromFile: string, source: string): string | null {
  const root = source.startsWith("@/") ? projectRoot(fromFile) : null;

  const base = source.startsWith(".")
    ? resolve(dirname(fromFile), source)
    : root
      ? join(root, "src", source.slice(2))
      : null;

  if (base === null) return null;

  return SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`).find((file) => existsSync(file)) ?? null;
}

/** Whether the app's own module at `source` marks `name`, or the whole file, with 'worklet'. */
function exportsWorklet(fromFile: string, source: string, name: string): boolean {
  const file = moduleFile(fromFile, source);

  if (file === null) return false;
  const text = readFileSync(file, "utf8");

  if (/^\s*["']worklet["']/.test(text)) return true;
  const escaped = name.replace(/\$/g, "\\$");

  const declared = new RegExp(
    `(function\\s+${escaped}\\s*\\([^)]*\\)[^{]*\\{|const\\s+${escaped}\\s*=\\s*(function\\s*)?\\([^)]*\\)[^={]*(=>)?\\s*\\{)\\s*["']worklet["']`,
  );

  return declared.test(text);
}

function rootIdentifier(node: ESTree.Node): ESTree.IdentifierReference | null {
  let current = node;

  while (current.type === "MemberExpression") current = current.object;

  return current.type === "Identifier" ? current : null;
}

function runsOnJs(config: ESTree.ObjectExpression): boolean {
  return config.properties.some(
    (property) =>
      property.type === "Property" &&
      property.key.type === "Identifier" &&
      property.key.name === "runOnJS" &&
      property.value.type === "Literal" &&
      property.value.value === true,
  );
}

/**
 * Inside a worklet, call only worklets. A plain function called on the UI thread crashes a release
 * build with "Tried to synchronously call a Remote Function"; the Meter crash in f01d9ab was a plain
 * `clamp` called inside `useDerivedValue`.
 *
 * It finds worklets written inline as the callback of a Reanimated hook or animation (`useAnimatedStyle`,
 * `useDerivedValue`, `useAnimatedReaction`, `withTiming`'s end callback, …), of a Gesture Handler 3 hook
 * (`usePanGesture({ onUpdate })`, unless `runOnJS: true`), or any function marked 'worklet'. Inside one it
 * reports a call to a function from the same file that is not marked 'worklet', to a prop, state setter
 * or other value from the component, and to anything imported from outside Reanimated and Worklets
 * unless the app's own module marks it 'worklet'.
 *
 * It does not catch: a worklet passed by name (`useAnimatedStyle(style)`) or built before it is passed,
 * hooks called as members (`Reanimated.useDerivedValue`), Gesture Handler builder chains
 * (`Gesture.Pan().onUpdate`) unless their callbacks say 'worklet', layout animation and Keyframe
 * callbacks, globals (`setTimeout`, `fetch`), methods on the component's own values
 * (`ref.current.focus()`, `props.onDone()`). It trusts an app module that says 'worklet' for the name,
 * or at the top of the file, without checking what that function calls. A clean run is not proof. The
 * other way, it reports an import it cannot read, from a package or from `@web/`, even when it is a worklet.
 */
export const noJsCallInWorkletRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Inside a Reanimated or Gesture Handler worklet, call only worklets. Catches plain functions from the same file, component values and non-worklet imports called in inline worklets; misses worklets passed by name, member-call hooks, builder chains, layout animation callbacks, globals and methods on component values.",
    },
    messages: {
      plain:
        "`{{name}}` is not a worklet, and this runs on the UI thread, which crashes a release build. Work the value out outside the worklet, mark `{{name}}` with 'worklet', or call back with scheduleOnRN.",
      imported:
        "`{{name}}` comes from `{{from}}`, which is not marked 'worklet', and this runs on the UI thread. Work the value out outside the worklet or call back with scheduleOnRN.",
    },
  },
  createOnce(context) {
    let worklets = new Set<ESTree.Node>();

    const markWorklet = (argument: ESTree.Node | undefined) => {
      if (isFunction(argument)) {
        worklets.add(argument);

        return;
      }

      if (argument?.type !== "ObjectExpression" || runsOnJs(argument)) return;

      for (const property of argument.properties) {
        if (property.type === "Property" && isFunction(property.value)) worklets.add(property.value);
      }
    };

    const enclosingWorklet = (node: ESTree.Node): WorkletFunction | null => {
      for (let current = node.parent; current; current = current.parent) {
        if (isFunction(current) && (worklets.has(current) || hasWorkletDirective(current))) return current;
      }

      return null;
    };

    const within = (inner: ESTree.Node, outer: ESTree.Node) =>
      inner.range[0] >= outer.range[0] && inner.range[1] <= outer.range[1];

    const importedFrom = (definition: { parent?: ESTree.Node | null }) =>
      definition.parent?.type === "ImportDeclaration" ? String(definition.parent.source.value) : "?";

    const checkIdentifierCall = (node: ESTree.CallExpression, callee: ESTree.IdentifierReference, worklet: WorkletFunction) => {
      const definition = resolveVariable(context.sourceCode, callee)?.defs[0];

      if (definition === undefined || within(definition.name, worklet)) return;

      if (definition.type === "ImportBinding") {
        const from = importedFrom(definition);

        if (WORKLET_MODULES.has(from)) return;

        const imported =
          definition.node.type === "ImportSpecifier" && definition.node.imported.type === "Identifier"
            ? definition.node.imported.name
            : callee.name;

        if (exportsWorklet(context.filename, from, imported)) return;
        context.report({ node, messageId: "imported", data: { name: callee.name, from } });

        return;
      }

      const target = definition.node.type === "VariableDeclarator" ? definition.node.init : definition.node;

      if (isFunction(target) && target !== worklet && hasWorkletDirective(target)) return;
      context.report({ node, messageId: "plain", data: { name: callee.name } });
    };

    const checkMemberCall = (node: ESTree.CallExpression, callee: ESTree.MemberExpression) => {
      const root = rootIdentifier(callee);
      const definition = root ? resolveVariable(context.sourceCode, root)?.defs[0] : undefined;

      if (definition?.type !== "ImportBinding") return;
      const from = importedFrom(definition);

      if (WORKLET_MODULES.has(from)) return;
      context.report({ node, messageId: "imported", data: { name: context.sourceCode.getText(callee), from } });
    };

    return {
      Program() {
        worklets = new Set();
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier") {
          for (const position of WORKLET_ARGUMENTS.get(node.callee.name) ?? []) markWorklet(node.arguments[position]);

          if (GESTURE_HOOK.test(node.callee.name)) markWorklet(node.arguments[0]);
        }

        const worklet = enclosingWorklet(node);

        if (worklet === null) return;

        if (node.callee.type === "Identifier") checkIdentifierCall(node, node.callee, worklet);
        else if (node.callee.type === "MemberExpression") checkMemberCall(node, node.callee);
      },
    };
  },
});
