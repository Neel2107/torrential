import { RuleTester } from "oxlint/plugins-dev";

import { noCommentsRule } from "./no-comments.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const error = { messageId: "comment" };

tester.run("anti-slop/no-comments", noCommentsRule, {
  valid: [
    "/** Whole points, so three posters never wrap. */\nconst width = 1;",
    "// SAFETY: the engine writes this type.\nconst page = reply as Page;",
    "// oxlint-disable-next-line no-console\nconsole.log(1);",
    "// @ts-expect-error the library's type is wrong\nlibrary.call();",
    "const url = 'https://example.com/path'; const tag = <a href=\"//x\" />;",
  ],
  invalid: [
    { name: "line comment", code: "// Whole points.\nconst width = 1;", errors: [error] },
    { name: "trailing comment", code: "const width = 1; // whole points", errors: [error] },
    { name: "block comment", code: "/* whole points */\nconst width = 1;", errors: [error] },
    { name: "two lines", code: "// one\n// two\nconst width = 1;", errors: [error, error] },
  ],
});
