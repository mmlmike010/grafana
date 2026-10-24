// Fails if the preload (or anything it pulls in from ../shared) imports outside the allowlist:
//   - `electron`: named imports of ALLOWED_ELECTRON_IMPORTS only (type-only imports are erased and always allowed)
//   - relative imports that resolve inside src/preload/ or src/shared/
// Files in src/shared/ reached from the preload may only import other src/shared/ files, because shared code
// also runs in main and must stay process-agnostic.
// Usage: node scripts/check-preload-imports.mjs [srcDir]   (default: desktop/src)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

export const ALLOWED_ELECTRON_IMPORTS = ['contextBridge', 'ipcRenderer'];

function listTsFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTsFiles(full);
    }
    return /\.(ts|mts|cts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, path.join(base, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function isInside(dir, file) {
  const rel = path.relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function collectImports(sourceFile) {
  const found = [];
  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      let names = null;
      let typeOnly = false;
      if (clause) {
        typeOnly = clause.isTypeOnly;
        names = [];
        if (clause.name) {
          names.push('default');
        }
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          names.push('*');
        } else if (clause.namedBindings) {
          const valueElements = clause.namedBindings.elements.filter((el) => !el.isTypeOnly);
          names.push(...valueElements.map((el) => (el.propertyName ?? el.name).text));
          if (!clause.name && valueElements.length === 0 && clause.namedBindings.elements.length > 0) {
            typeOnly = true;
          }
        }
      }
      found.push({ spec: node.moduleSpecifier.text, kind: 'import', names, typeOnly, line: lineOf(node) });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ spec: node.moduleSpecifier.text, kind: 'export', typeOnly: node.isTypeOnly, line: lineOf(node) });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expr = node.moduleReference.expression;
      found.push({ spec: ts.isStringLiteral(expr) ? expr.text : null, kind: 'require', line: lineOf(node) });
    } else if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        const [arg] = node.arguments;
        const spec = arg && ts.isStringLiteralLike(arg) ? arg.text : null;
        found.push({ spec, kind: isRequire ? 'require' : 'dynamic import', line: lineOf(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export function checkPreloadImports(srcDir) {
  const preloadDir = path.join(srcDir, 'preload');
  const sharedDir = path.join(srcDir, 'shared');
  const violations = [];
  const queue = listTsFiles(preloadDir);
  const seen = new Set(queue);

  while (queue.length > 0) {
    const file = queue.shift();
    const inShared = isInside(sharedDir, file);
    const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const report = (line, message) => violations.push({ file: path.relative(srcDir, file), line, message });

    for (const imp of collectImports(sourceFile)) {
      if (imp.spec === null) {
        report(imp.line, `non-literal ${imp.kind} is not allowed`);
        continue;
      }
      if (imp.kind === 'require' || imp.kind === 'dynamic import') {
        report(imp.line, `${imp.kind}('${imp.spec}') is not allowed; use a static import from the allowlist`);
        continue;
      }
      if (imp.spec.startsWith('.')) {
        const resolved = resolveRelative(file, imp.spec);
        const allowedDirs = inShared ? [sharedDir] : [preloadDir, sharedDir];
        if (!resolved) {
          report(imp.line, `cannot resolve '${imp.spec}'`);
        } else if (!allowedDirs.some((dir) => isInside(dir, resolved))) {
          const scope = inShared ? 'src/shared/' : 'src/preload/ or src/shared/';
          report(imp.line, `'${imp.spec}' resolves outside ${scope}`);
        } else if (!seen.has(resolved)) {
          seen.add(resolved);
          queue.push(resolved);
        }
        continue;
      }
      if (imp.spec === 'electron' && !inShared) {
        if (imp.typeOnly) {
          continue;
        }
        const disallowed = imp.names === null ? ['(side-effect import)'] : imp.names;
        const bad =
          imp.kind === 'export' ? ['(re-export)'] : disallowed.filter((n) => !ALLOWED_ELECTRON_IMPORTS.includes(n));
        if (bad.length > 0) {
          report(
            imp.line,
            `electron import of ${bad.join(', ')} is not allowed; only ${ALLOWED_ELECTRON_IMPORTS.join(', ')}`
          );
        }
        continue;
      }
      report(imp.line, `'${imp.spec}' is not on the preload import allowlist`);
    }
  }
  return violations;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const srcDir = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src'));
  const violations = checkPreloadImports(srcDir);
  if (violations.length > 0) {
    console.error('Preload import allowlist violations:');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.message}`);
    }
    process.exit(1);
  }
  console.log('preload imports OK');
}
