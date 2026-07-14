# ts-node-workspace

A minimal, **Deno/Bun-like** TypeScript template. Node.js runs `.ts` files directly —
no `tsx`, `ts-node`, or build step. Managed with **Yarn Classic**.

## Requirements

- **Node.js >= 22.18** (flagless native TypeScript support via type stripping)
- **Yarn Classic** installed globally (`npm i -g yarn`)

## Usage

```bash
yarn install        # installs @typescript/native-preview (tsgo) + type defs

yarn start          # node src/index.ts
yarn start Alice    # pass args: prints "Hello, Alice."

yarn dev            # node --watch — auto-reloads on file changes
yarn typecheck      # tsgo --noEmit — Node does NOT type-check, so do it here / in CI
yarn lint           # oxlint --type-aware — fast Rust linter
yarn lint:fix       # oxlint --type-aware --fix — auto-fix what it can
```

## Fast linting with `oxlint`

Linting uses [`oxlint`](https://oxc.rs) (Rust, 50–100× faster than ESLint). It runs
`--type-aware`, which uses **tsgo** for rules that need type information — the same engine
as `yarn typecheck`. Config is in `.oxlintrc.json` (correctness + suspicious as errors;
noisy stylistic rules disabled). VS Code shows lint diagnostics inline via the recommended
**oxc** extension (`.vscode/extensions.json`).

### Enforced style rules

oxlint omits stylistic formatting rules by design, so two are added as a tiny local JS
plugin (`scripts/oxlint-style-plugin.js`, wired via `jsPlugins` in `.oxlintrc.json`):

- **`style/single-quote`** — strings must use single quotes (double quotes allowed only
  when the string itself contains a `'`, to avoid escaping).
- **`style/semi`** — statements must end with a semicolon (block-bodied declarations like
  functions/classes/interfaces are correctly exempt).

Both are report-only (no autofix) and use oxlint's ESLint-compatible plugin API, which is
currently **alpha** — the rules are intentionally small and dependency-free.

## Fast type checking with `tsgo` (TypeScript native / Go)

Type checking uses [`tsgo`](https://github.com/microsoft/typescript-go)
(`@typescript/native-preview`), the native Go port of the TypeScript compiler — several
times faster than the classic `tsc` (≈0.1s here). `yarn typecheck`, `yarn ts:co`, and
`yarn ts:co:watch` all use it. The classic `typescript`/`tsc` package is **not installed**.

VS Code IntelliSense uses tsgo as well via `.vscode/settings.json`
(`"js/ts.experimental.useTsgo": true`) — install the recommended
**TypeScript (Native Preview)** extension when prompted (`.vscode/extensions.json`).

> `tsgo` is a preview and not yet at full feature parity with `tsc`. If you hit a tsgo
> bug you can temporarily `yarn add -D typescript` and run `npx tsc --noEmit` to compare.

## Run any file (Deno/Bun-style)

`start`/`dev` are pinned to `src/index.ts`. To run **any** `.ts` file, use the `ts`
script — everything after the script name is forwarded to `node`:

```bash
yarn ts src/tools/seed.ts          # node src/tools/seed.ts
yarn ts src/index.ts Alice         # forward args to the script
yarn ts:watch src/server.ts        # node --watch <file> — auto-reload
```

## Run + type-check + lint in parallel

Node strips types without checking them. `ts:co` runs your file **and** a full-project
`tsgo --noEmit` type check **and** `oxlint` concurrently (via `scripts/co.ts`, zero deps),
so you get program output immediately and check results as soon as they finish:

```bash
yarn ts:co src/server.ts [args...]
```

Exit code is non-zero if the program, the type check, **or** the lint fails — handy for a
pre-commit or quick local gate.

### Watch mode

`ts:co:watch` re-runs your file, then re-type-checks and re-lints on every change. The
launcher owns the watch loop, so output is deterministic: it runs the program first, then
prints the verdicts **last** (`✔ type check passed` / `✔ lint passed`, or the diagnostics
+ `✖ … failed`), so any error is always the final thing on screen — never buried under
program output. Runs until you Ctrl-C:

```bash
yarn ts:co:watch src/server.ts [args...]
```

> Note: type errors are not runtime errors — Node strips types and runs the code anyway,
> so the program still executes. The type-check verdict below the output tells you whether
> the types are sound.

## Third-party npm packages

Install with Yarn and `import` them as ESM — this project is `"type": "module"`,
and Node's module system handles **both** ESM and CommonJS packages:

```bash
yarn add nanoid lodash chalk
yarn add -D @types/lodash        # types for packages that ship none
```

```ts
import { nanoid } from "nanoid";   // pure-ESM package
import _ from "lodash";            // CommonJS → default import is module.exports
import chalk from "chalk";         // CommonJS named exports are auto-detected

console.log(nanoid(), _.capitalize("hi"), chalk.green("ok"));
```

Notes:
- **CommonJS default import**: `import _ from "lodash"` gives you `module.exports`
  (enabled by `esModuleInterop`). Named imports from a CJS package work when Node can
  statically detect the export names; if one can't be detected, fall back to the default
  import and destructure: `import pkg from "cjs-only"; const { thing } = pkg;`.
- **Types**: many packages bundle their own; for those that don't, add `@types/<pkg>`.
- No bundler or build step is involved — Node resolves `node_modules` directly.

## How it works

Node strips TypeScript types at runtime (via the Amaro loader) and runs the resulting
JavaScript. There is **no type checking at runtime** — that's what `yarn typecheck` is for.

### Constraints (enforced by `erasableSyntaxOnly` in tsconfig)

Node can only strip *erasable* syntax. These are **not** supported and `tsgo` will flag them:

- `enum`
- Parameter properties (`constructor(private x: number)`)
- Runtime `namespace`s
- Import aliases with runtime meaning

Use a plain object + `as const`, or a type union, instead of `enum`.

### Relative imports need the `.ts` extension

```ts
import { greet } from "./greet.ts"; // ✅ required by Node at runtime
```

## Layout

```
src/
  index.ts       # entry point (yarn start)
  greet.ts       # sample module (erasable syntax only)
  deps-demo.ts   # example: importing ESM + CommonJS npm packages
scripts/
  co.ts          # run + type-check + lint launcher (ts:co / ts:co:watch)
  oxlint-style-plugin.js  # custom oxlint rules: single-quote + semi
.vscode/
  settings.json  # tsgo IntelliSense
  extensions.json
.oxlintrc.json   # oxlint config
tsconfig.json
package.json
```
