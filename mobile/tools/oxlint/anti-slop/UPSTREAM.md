# Provenance

- Source: https://github.com/dmmulroy/anti-slop, `src/`.
- Incoming: `63dbb09f73438e550a6991dc6d778f979ffbf183` (2026-11-20). It changes only `README.md` and the skill's `SKILL.md` from the base; `src/` is byte-identical.
- Base: `13909c9e07590f5a85d93c62712259fe14a883f7`, the commit this copy was first vendored from. Apart from the registrations in `index.ts`, every upstream file here matches it byte for byte.
- `LICENSE` is upstream's MIT licence. `vendor/eslint-stylistic/` keeps its own licence and provenance.
- `UPDATE.md` is upstream's `skills/install-anti-slop/references/update.md` at the incoming commit, unchanged.

## Local to this app

- `rules/no-js-call-in-worklet.ts`, `rules/no-worklet-reads-later-constant.ts` and `rules/no-comments.ts`, with their tests, registered in `index.ts`. Upstream has none of them.
- `package.json` (`"type": "module"`) and `tsconfig.json` (upstream's, with `types: ["node"]` and the tests included), so `pnpm test:tools` typechecks the plugin.

## Not adopted

- The Effect plugin's rules are vendored and tested but not enabled: the app does not depend on `effect`.
- Upstream's `ignorePatterns` for agent directories: lint runs on `src` only, so they would match nothing.
- The skill's bundled assets and `install.mjs`: they copy the same files. To update, clone upstream at the wanted commit into a scratch directory and follow `UPDATE.md` with that checkout as the incoming source.
- Upstream now recommends `cloudflare/oxlint-config` over anti-slop. It is a different, type-aware preset (oxlint 1.94 and `tsrs`), not an update to this plugin.
