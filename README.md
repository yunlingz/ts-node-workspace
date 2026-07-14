# ts-node-workspace

A minimal, **Deno/Bun-like** TypeScript template. Node.js runs `.ts` files directly —
no `tsx`, `ts-node`, or build step. Managed with **Yarn Classic**.

## Requirements

- **Node.js >= 22.18** (flagless native TypeScript support via type stripping)
- **Yarn Classic** installed globally (`npm i -g yarn`)

## Usage

```bash
yarn install        # installs typescript (the only devDependency)

yarn start          # node src/index.ts
yarn start Alice    # pass args: prints "Hello, Alice."

yarn dev            # node --watch — auto-reloads on file changes
yarn typecheck      # tsc --noEmit — Node does NOT type-check, so do it here / in CI
```

## Run any file (Deno/Bun-style)

`start`/`dev` are pinned to `src/index.ts`. To run **any** `.ts` file, use the `ts`
script — everything after the script name is forwarded to `node`:

```bash
yarn ts src/tools/seed.ts          # node src/tools/seed.ts
yarn ts src/index.ts Alice         # forward args to the script
yarn ts:watch src/server.ts        # node --watch <file> — auto-reload
```

## Run + type-check in parallel

Node strips types without checking them. `ts:co` runs your file **and** a full-project
`tsc --noEmit` concurrently (via `scripts/co.ts`, zero deps), so you get program output
immediately and type diagnostics as soon as the check finishes:

```bash
yarn ts:co src/server.ts [args...]
```

Exit code is non-zero if **either** the program or the type check fails — handy for a
pre-commit or quick local gate. Wall-clock ≈ the slower of the two, not the sum.

### Watch mode

`ts:co:watch` keeps both running: `node --watch` re-runs your file and
`tsc --noEmit --watch` re-checks the project on every change. Runs until you Ctrl-C
(both children are stopped together):

```bash
yarn ts:co:watch src/server.ts [args...]
```

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

Node can only strip *erasable* syntax. These are **not** supported and `tsc` will flag them:

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
  co.ts          # run + type-check launcher (ts:co / ts:co:watch)
tsconfig.json
package.json
```
