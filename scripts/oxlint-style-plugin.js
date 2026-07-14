// Minimal oxlint JS plugin adding two style rules that oxlint omits by design:
//   style/single-quote — prefer single-quoted strings
//   style/semi         — require semicolons at statement ends
//
// ESLint-compatible plugin API (oxlint JS Plugins, currently alpha). Plain JS so
// oxlint loads it directly with no build step. Report-only (no autofix).

/** Statement node types that must end with a semicolon. */
const SEMI_NODES = [
  'ExpressionStatement',
  'VariableDeclaration',
  'ReturnStatement',
  'ThrowStatement',
  'BreakStatement',
  'ContinueStatement',
  'DebuggerStatement',
  'ImportDeclaration',
  'ExportAllDeclaration',
  'TSTypeAliasDeclaration',
];

/** Declaration kinds that are block-bodied and take NO trailing semicolon. */
const BLOCK_BODIED = new Set([
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSInterfaceDeclaration',
  'TSModuleDeclaration',
  'TSEnumDeclaration',
]);

/** Report string literals written with double quotes (unless they contain a '). */
const singleQuote = {
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') {
          return;
        }
        const raw = node.raw;
        if (!raw || raw[0] !== '"') {
          return;
        }
        // Allow double quotes when the string contains a single quote, to avoid
        // forcing escapes (same spirit as ESLint's `avoidEscape`).
        if (node.value.includes("'")) {
          return;
        }
        context.report({ message: 'Prefer single-quoted strings.', node });
      },
    };
  },
};

/** Report statements whose last meaningful character is not a semicolon. */
const semi = {
  create(context) {
    const sc = context.sourceCode ?? context.getSourceCode?.();
    const text = sc?.text ?? sc?.getText?.();

    function check(node) {
      if (!text) {
        return;
      } // no source access → skip rather than false-positive
      // A `VariableDeclaration` used as a for-loop head or inside an export is
      // covered elsewhere (the loop / export node), so skip it here.
      const parentType = node.parent?.type;
      if (
        node.type === 'VariableDeclaration' &&
        (parentType === 'ExportNamedDeclaration' ||
          parentType === 'ExportDefaultDeclaration' ||
          parentType === 'ForStatement' ||
          parentType === 'ForOfStatement' ||
          parentType === 'ForInStatement')
      ) {
        return;
      }
      const end = node.range ? node.range[1] : node.end;
      // Walk back over trailing whitespace within the node's own range.
      let i = end - 1;
      while (i >= 0 && /\s/.test(text[i])) {
        i--;
      }
      if (text[i] !== ';') {
        context.report({ message: 'Missing semicolon.', node });
      }
    }

    const visitor = {};
    for (const type of SEMI_NODES) {
      visitor[type] = check;
    }

    // Exports: `export function/class/interface … {}` take no semicolon, but
    // `export const x = 1` and `export { a }` / `export default expr` do.
    function checkExport(node) {
      if (node.declaration && BLOCK_BODIED.has(node.declaration.type)) {
        return;
      }
      check(node);
    }
    visitor.ExportNamedDeclaration = checkExport;
    visitor.ExportDefaultDeclaration = checkExport;

    return visitor;
  },
};

export default {
  meta: { name: 'style' },
  rules: {
    'single-quote': singleQuote,
    semi,
  },
};
