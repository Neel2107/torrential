import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

type WorkletFunction = ESTree.Function | ESTree.ArrowFunctionExpression;
type IdentifierNode = Extract<ESTree.Node, { type: "Identifier" }>;

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

function isFunction(node: ESTree.Node | null | undefined): node is WorkletFunction {
  return (
    node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression" || node?.type === "FunctionDeclaration"
  );
}

function hasWorkletDirective(fn: WorkletFunction): boolean {
  if (fn.body?.type !== "BlockStatement") return false;
  const first = fn.body.body[0];

  return first?.type === "ExpressionStatement" && "directive" in first && first.directive === "worklet";
}

function calleeName(call: ESTree.CallExpression): string | null {
  if (call.callee.type === "Identifier") return call.callee.name;
  if (call.callee.type === "MemberExpression" && call.callee.property.type === "Identifier") return call.callee.property.name;

  return null;
}

function isNode(value: unknown): value is ESTree.Node {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}

function children(node: ESTree.Node): ESTree.Node[] {
  const found: ESTree.Node[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) found.push(...value.filter(isNode));
    else if (isNode(value)) found.push(value);
  }

  return found;
}

function readsIn(fn: WorkletFunction): IdentifierNode[] {
  const reads: IdentifierNode[] = [];
  const pending: (ESTree.Node | null)[] = [fn.body];

  while (pending.length > 0) {
    const node = pending.pop();

    if (!node) continue;
    if (node.type === "Identifier") reads.push(node);
    for (const child of children(node)) {
      if (node.type === "MemberExpression" && !node.computed && child === node.property) continue;
      if (node.type === "Property" && !node.computed && child === node.key) continue;
      pending.push(child);
    }
  }

  return reads;
}

/**
 * Ban a worklet reading a top-level constant declared further down its file. Such a read once came through as
 * `undefined` on the UI thread and crashed a release build at the first tap; declare what a worklet reads above it.
 */
export const noWorkletReadsLaterConstantRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow a Reanimated worklet reading a top-level constant declared below it in the same file.",
    },
    messages: {
      later:
        "This worklet reads `{{name}}`, which is declared further down the file; a worklet can capture it as undefined and crash on the UI thread. Move `{{name}}` above the code that uses it.",
    },
  },
  createOnce(context) {
    const declaredAt = new Map<string, number>();
    const worklets: WorkletFunction[] = [];

    return {
      Program(program) {
        declaredAt.clear();
        worklets.length = 0;
        for (const statement of program.body) {
          const declaration =
            statement.type === "ExportNamedDeclaration" && statement.declaration ? statement.declaration : statement;

          if (declaration.type !== "VariableDeclaration") continue;
          for (const declarator of declaration.declarations) {
            if (declarator.id.type === "Identifier") declaredAt.set(declarator.id.name, declarator.start);
          }
        }
      },
      CallExpression(call) {
        const positions = WORKLET_ARGUMENTS.get(calleeName(call) ?? "");

        if (!positions) return;
        for (const position of positions) {
          const argument = call.arguments[position];

          if (isFunction(argument)) worklets.push(argument);
        }
      },
      FunctionDeclaration(fn) {
        if (hasWorkletDirective(fn)) worklets.push(fn);
      },
      ArrowFunctionExpression(fn) {
        if (hasWorkletDirective(fn)) worklets.push(fn);
      },
      FunctionExpression(fn) {
        if (hasWorkletDirective(fn)) worklets.push(fn);
      },
      "Program:exit"() {
        for (const fn of worklets) {
          for (const read of readsIn(fn)) {
            const at = declaredAt.get(read.name);

            if (at !== undefined && at > fn.start) context.report({ node: read, messageId: "later", data: { name: read.name } });
          }
        }
      },
    };
  },
});
