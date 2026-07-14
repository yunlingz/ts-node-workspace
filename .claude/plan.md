# Plan: Node.js native-TypeScript project template (Yarn Classic)

## Goal
A minimal, Deno/Bun-like template where `node src/index.ts` just works — no `tsx`/`ts-node`
wrapper. Uses Node 22.18+ native type stripping. Managed by globally installed Yarn Classic.

## Key decisions (confirmed)
- Runner: **native `node file.ts`** (type stripping via Amaro, no flags on Node >=22.18)
- Type checking: **`tsc --noEmit`** script + `erasableSyntaxOnly: true` in tsconfig
  (typescript is the ONLY devDependency)
- Watch: **`node --watch`** (built-in) for a `dev` script
- Engine guard: **`"engines": { "node": ">=22.18" }`**

## Files to create
1. **package.json**
   - `"type": "module"`, `"private": true`, `"engines": { "node": ">=22.18" }`
   - scripts:
     - `start`: `node src/index.ts`
     - `dev`: `node --watch src/index.ts`
     - `typecheck`: `tsc --noEmit`
   - devDependencies: `typescript` (^5.8, for `erasableSyntaxOnly`)

2. **tsconfig.json** — aligned with Node's recommended type-stripping options
   - `module: "nodenext"`, `target: "esnext"`, `strict: true`
   - `noEmit: true`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`
   - `allowImportingTsExtensions: true`, `rewriteRelativeImportExtensions: true`

3. **src/index.ts** — tiny sample entry that imports a local `.ts` module (demonstrates
   the `.ts` import extension) and logs output, so `yarn start` shows it working.

4. **src/greet.ts** — sample module using only erasable syntax (interface + typed fn).

5. **.gitignore** — `node_modules`, logs, etc.

6. **README.md** — how to use: `yarn install`, `yarn start`, `yarn dev`, `yarn typecheck`;
   notes on the erasable-syntax limitation (no `enum`/namespaces) and Node version requirement.

## Notes / caveats to document
- Node strips types, does not check them → run `yarn typecheck` (and in CI).
- `erasableSyntaxOnly` makes tsc error on non-strippable syntax (enum, param properties,
  runtime namespaces) so you never write code Node can't run.
- Relative imports must include the `.ts` extension when run by Node.

## Verification
- `yarn install` (installs typescript only)
- `yarn start` → prints sample greeting
- `yarn typecheck` → passes
- `yarn dev` → starts in watch mode
