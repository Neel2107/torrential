#!/usr/bin/env node
// Fails when the Hermes bundle `expo export` wrote for Android or iOS is larger than its budget in
// src/perf/bundle.json, or when either bundle or budget is missing. Prints both sizes, and adds them to
// the GitHub step summary when there is one. Raising a budget needs a Raises-ceiling: line (guard.sh).
//
//   node scripts/bundle-budget.js [<export dir>]     default: dist
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] ?? 'dist');
const budgets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'perf', 'bundle.json'), 'utf8'));
const megabytes = (bytes) => `${(bytes / 1_000_000).toFixed(2)} MB`;

function bundleOf(platform) {
  const dir = path.join(dist, '_expo', 'static', 'js', platform);
  const found = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.hbc')) : [];

  return found.length === 1 ? fs.statSync(path.join(dir, found[0])).size : null;
}

const problems = [];
const rows = ['android', 'ios'].map((platform) => {
  const size = bundleOf(platform);
  const budget = budgets[platform];

  if (size === null) problems.push(`no single ${platform} .hbc under ${dist}`);
  else if (!Number.isInteger(budget)) problems.push(`no ${platform} budget in src/perf/bundle.json`);
  else if (size > budget) {
    problems.push(`the ${platform} bundle is ${size} bytes, over its budget of ${budget} by ${size - budget}`);
  }

  const over = size === null || !Number.isInteger(budget) || size > budget;
  const shown = size === null ? 'missing' : `${megabytes(size)} (${size})`;
  const allowed = Number.isInteger(budget) ? `${megabytes(budget)} (${budget})` : 'none';

  return `| ${over ? '❌' : '✅'} | ${platform} | ${shown} | ${allowed} |`;
});

const report = [
  '## Bundle budget',
  '',
  'The Hermes bundle `expo export` writes, against `mobile/src/perf/bundle.json`.',
  '',
  '| | Platform | Size (bytes) | Budget (bytes) |',
  '| --- | --- | ---: | ---: |',
  ...rows,
  '',
].join('\n');

console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);

for (const problem of problems) console.error(`bundle-budget: ${problem}`);
process.exit(problems.length === 0 ? 0 : 1);
