import { defineRule } from "@oxlint/plugins";

const DIRECTIVES = /^\s*(SAFETY:|oxlint-|eslint-|@ts-(expect-error|ignore|nocheck)|prettier-ignore|global\s)/u;

/**
 * Ban comments in code. A doc comment (`/** … *\/`) may state a rule the code cannot show, attached to what it
 * describes; `// SAFETY:` explains a type assertion; tool directives stay. Everything else is noise or belongs in
 * a name, a type or a doc comment.
 */
export const noCommentsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow comments other than doc comments, `// SAFETY:` lines and tool directives; name things so the code reads on its own.",
    },
    messages: {
      comment:
        "Remove this comment. Name the code so it reads on its own; a rule the code can't show goes in a `/** */` doc comment on what it describes.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === "Shebang") continue;
          if (comment.type === "Block" && comment.value.startsWith("*")) continue;
          if (DIRECTIVES.test(comment.value)) continue;
          context.report({ loc: context.sourceCode.getLocFromIndex(comment.start), messageId: "comment" });
        }
      },
    };
  },
});
