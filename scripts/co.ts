// Runs a .ts file alongside a full-project type check and lint.
//
//   yarn ts:co        src/server.ts [args...]   # run once + type-check + lint once
//   yarn ts:co:watch  src/server.ts [args...]   # re-run + re-check + re-lint on change
//
// One-shot mode: runs `node`, `tsgo --noEmit`, and `oxlint` in parallel; exit
// code is non-zero if ANY of them fail.
//
// Watch mode: this script owns the watch loop (fs.watch on the project),
// so output ordering is deterministic — on every change it runs the program,
// THEN runs a one-shot type check + lint and prints the results LAST, so any
// error is always the final thing on screen (never buried under program output).
// Runs until Ctrl-C.
//
// Type checking uses `tsgo` (native Go compiler); linting uses `oxlint`.
// Zero external deps — node:child_process + node:module + node:fs.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { watch as fsWatch } from 'node:fs';

const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const watch = argv[0] === '--watch';
const positional = watch ? argv.slice(1) : argv;

if (positional.length === 0) {
  console.error('usage: yarn ts:co[:watch] <file.ts> [args...]');
  process.exit(1);
}

const entry: string = positional[0]!;
const rest = positional.slice(1);

/** Resolve a locally-installed package's binary via its package `bin`. */
function localBin(pkg: string, unixBin: string, winBin: string): string {
  const manifest = require.resolve(`${pkg}/package.json`);
  const suffix = process.platform === 'win32' ? winBin : unixBin;
  return manifest.replace(/package\.json$/, suffix);
}

const tsgoBin = () =>
  localBin('@typescript/native-preview', 'bin/tsgo', 'bin\\tsgo.exe');
const oxlintBin = () => localBin('oxlint', 'bin/oxlint', 'bin\\oxlint.exe');

function spawnInherit(command: string, args: string[]): ChildProcess {
  return spawn(command, args, { stdio: 'inherit' });
}

function exitCode(c: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    c.on('exit', (code) => resolve(code ?? 1));
    c.on('error', (err) => {
      console.error(`failed to start: ${err.message}`);
      resolve(1);
    });
  });
}

if (!watch) {
  // One-shot: run all three to completion in parallel, aggregate exit codes.
  const [programCode, typecheckCode, lintCode] = await Promise.all([
    exitCode(spawnInherit(process.execPath, [entry, ...rest])),
    exitCode(spawnInherit(tsgoBin(), ['--noEmit'])),
    exitCode(spawnInherit(oxlintBin(), ['--type-aware'])),
  ]);
  if (typecheckCode !== 0) console.error('\n✖ type check failed');
  if (lintCode !== 0) console.error('✖ lint failed');
  process.exit(programCode || typecheckCode || lintCode);
}

// ---- Watch mode: we drive the loop so ordering is deterministic. ----

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let program: ChildProcess | null = null;
let running = false;
let queued = false;

/** Run one checker to completion, print its output, return its verdict line. */
function check(label: string, bin: string, args: string[]): string {
  const r = spawnSync(bin, args, { encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (r.status === 0) return `${GREEN}✔ ${label} passed${RESET}`;
  if (out) console.log(out);
  return `${RED}✖ ${label} failed${RESET}`;
}

/** Run the program (streamed) then type check + lint (verdicts printed last). */
async function cycle() {
  if (running) {
    queued = true;
    return;
  }
  running = true;

  // 1. (Re)start the program.
  if (program) program.kill('SIGTERM');
  console.log(`${DIM}— running ${entry} —${RESET}`);
  program = spawnInherit(process.execPath, [entry, ...rest]);
  await exitCode(program);
  program = null;

  // 2. Type check + lint, one-shot; print verdicts LAST so they can't be buried.
  console.log(`${DIM}— type checking (tsgo) + linting (oxlint) —${RESET}`);
  const tc = check('type check', tsgoBin(), ['--noEmit']);
  const lint = check('lint', oxlintBin(), ['--type-aware']);
  console.log(tc);
  console.log(lint);
  console.log(`${DIM}— waiting for changes (Ctrl-C to stop) —${RESET}\n`);

  running = false;
  if (queued) {
    queued = false;
    void cycle();
  }
}

// Debounced watcher over the project (cwd), ignoring node_modules/.git.
let timer: ReturnType<typeof setTimeout> | null = null;
const watcher = fsWatch(process.cwd(), { recursive: true }, (_e, file) => {
  const f = file ?? '';
  if (f.includes('node_modules') || f.startsWith('.git')) return;
  if (!/\.(ts|tsx|mts|cts|json)$/.test(f)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void cycle(), 100);
});

function shutdown() {
  watcher.close();
  if (program) program.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void cycle(); // initial run
