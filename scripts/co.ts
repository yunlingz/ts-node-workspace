// Runs a .ts file alongside a full-project type check, concurrently.
//
//   yarn ts:co        src/server.ts [args...]   # run once + type-check once
//   yarn ts:co:watch  src/server.ts [args...]   # re-run + re-check on every change
//
// - The program's stdio is inherited (you see its output live).
// - `tsc --noEmit` runs in parallel; in watch mode it stays resident and
//   re-reports diagnostics on each change.
// - One-shot mode: exit code is non-zero if EITHER side fails.
// - Watch mode: runs until you Ctrl-C (both children are killed together).
//
// Zero dependencies — uses only node:child_process + node:module.

import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const watch = argv[0] === "--watch";
const [entry, ...rest] = watch ? argv.slice(1) : argv;

if (!entry) {
  console.error("usage: yarn ts:co[:watch] <file.ts> [args...]");
  process.exit(1);
}

/** Resolve the locally-installed `tsc` CLI entry point. */
function tscBin(): string {
  // typescript ships its CLI at bin/tsc; resolve via its package.json.
  const pkg = require.resolve("typescript/package.json");
  return pkg.replace(/package\.json$/, "bin/tsc");
}

/** Spawn `node <args>`, returning the child process. */
function spawnNode(args: string[]): ChildProcess {
  return spawn(process.execPath, args, { stdio: "inherit" });
}

const runArgs = watch ? ["--watch", entry, ...rest] : [entry, ...rest];
const tscArgs = watch
  ? [tscBin(), "--noEmit", "--watch", "--preserveWatchOutput"]
  : [tscBin(), "--noEmit"];

if (watch) {
  // Long-running: both processes stay up until interrupted.
  const program = spawnNode(runArgs);
  const typecheck = spawnNode(tscArgs);
  const children = [program, typecheck];

  const shutdown = () => {
    for (const c of children) c.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // If either child dies unexpectedly, tear down the other.
  for (const c of children) c.on("exit", shutdown);
} else {
  // One-shot: run both to completion, aggregate the exit codes.
  const toCode = (c: ChildProcess) =>
    new Promise<number>((resolve) => {
      c.on("exit", (code) => resolve(code ?? 1));
      c.on("error", (err) => {
        console.error(`failed to start: ${err.message}`);
        resolve(1);
      });
    });

  const [programCode, typecheckCode] = await Promise.all([
    toCode(spawnNode(runArgs)),
    toCode(spawnNode(tscArgs)),
  ]);

  if (typecheckCode !== 0) console.error("\n✖ type check failed");
  process.exit(programCode || typecheckCode);
}
