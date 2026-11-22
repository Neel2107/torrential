#!/usr/bin/env node
// Lists the components and hooks React Compiler refuses to compile, and fails when there are more than --max.
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const maxIndex = process.argv.indexOf('--max');
const max = maxIndex === -1 ? Infinity : Number(process.argv[maxIndex + 1]);

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.tsx?$/.test(name)) files.push(full);
  }
})(root);

const skipped = [];
for (const file of files) {
  babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
    plugins: [
      [
        'babel-plugin-react-compiler',
        {
          panicThreshold: 'none',
          logger: {
            logEvent: (_, event) => {
              if (event.kind !== 'CompileError') return;
              const detail = event.detail ?? {};
              const reason = detail.reason ?? detail.options?.reason ?? 'unknown';
              const line = JSON.stringify(detail).match(/"start":\{"line":(\d+)/)?.[1] ?? '?';
              skipped.push(`${path.relative(root, file)}:${line}  ${String(reason).slice(0, 110)}`);
            },
          },
        },
      ],
    ],
  });
}

const unique = [...new Set(skipped)];
for (const line of unique) console.log(line);
console.log(`React Compiler skips ${unique.length} places`);
if (unique.length > max) {
  console.error(`More than the ${max} allowed. A shared value read with .value, a ref read while rendering, or a hook result changed in place is the usual cause.`);
  process.exit(1);
}
