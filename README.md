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
  index.ts   # entry point (yarn start)
  greet.ts   # sample module (erasable syntax only)
tsconfig.json
package.json
```
