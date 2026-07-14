// Demonstrates importing third-party packages of every module flavor,
// all with ESM `import` syntax, run directly by Node.

// 1. Pure-ESM package (nanoid v5 is "type": "module")
import { nanoid } from 'nanoid';

// 2. CommonJS package with a default-style export (lodash)
//    Node's ESM interop gives you the module.exports as the default import.
import _ from 'lodash';

// 3. CommonJS package whose exports Node can statically detect as named
//    (chalk v4). Node's cjs-named-exports detection makes this work.
import chalk from 'chalk';

console.log('nanoid (esm pkg):', nanoid(8));
console.log('lodash (cjs default):', _.capitalize('hello world'));
console.log('lodash chunk:', _.chunk([1, 2, 3, 4, 5], 2));
console.log(chalk.green('chalk (cjs) works too'));
