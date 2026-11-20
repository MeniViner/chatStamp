const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const unique = (values) => [...new Set(values)].sort();
const unwrap = (node) => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
};

function flattenLocale(value, prefix = '', result = {}) {
  if (typeof value === 'string') result[prefix] = value;
  else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) flattenLocale(nested, prefix ? `${prefix}.${key}` : key, result);
  } else throw new Error(`Translation ${prefix || '<root>'} must be a string or object`);
  return result;
}

function interpolationNames(value) {
  return unique([...value.matchAll(/{{\s*-?\s*([\w.]+)(?:\s*,[^{}]+)?\s*}}/g)].map((match) => match[1]));
}

/**
 * Inspect real translation arguments. Finite keys come from TypeScript literal
 * unions or the actual initializer/return/property consumed by that argument.
 * No resource namespace, prefix or test source is treated as usage.
 * @param {{files: Record<string,string>, en: object, he: object, entryFiles?: string[], compilerOptions?: object}} options
 */
function auditI18nSources({ files, en, he, entryFiles = Object.keys(files), compilerOptions = {} }) {
  const normalized = new Map(Object.entries(files).map(([name, text]) => [path.resolve(name), text]));
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, skipLibCheck: true, allowJs: true, resolveJsonModule: true, ...compilerOptions };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host);
  const directoryExists = host.directoryExists?.bind(host);
  host.readFile = (name) => normalized.get(path.resolve(name)) ?? readFile(name);
  host.fileExists = (name) => normalized.has(path.resolve(name)) || fileExists(name);
  host.directoryExists = (name) => [...normalized.keys()].some((file) => file.startsWith(path.resolve(name) + path.sep)) || Boolean(directoryExists?.(name));
  host.getSourceFile = (name, languageVersion) => {
    const text = host.readFile(name);
    return text === undefined ? undefined : ts.createSourceFile(name, text, languageVersion, true);
  };
  const program = ts.createProgram([...normalized.keys()], options, host);
  const checker = program.getTypeChecker();
  const sources = new Map(program.getSourceFiles().filter((source) => normalized.has(path.resolve(source.fileName)))
    .map((source) => [path.resolve(source.fileName), source]));
  const visited = new Set();
  function reachable(name) {
    name = path.resolve(name);
    if (visited.has(name) || !sources.has(name)) return;
    visited.add(name);
    const scan = (node) => {
      let specifier;
      const typeImport = ts.isImportDeclaration(node) && (node.importClause?.isTypeOnly
        || (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
          && !node.importClause.name && node.importClause.namedBindings.elements.every((element) => element.isTypeOnly)));
      if (!typeImport && (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && !node.isTypeOnly
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) specifier = node.arguments[0].text;
      if (specifier?.startsWith('.')) {
        const resolved = ts.resolveModuleName(specifier, name, options, host).resolvedModule?.resolvedFileName;
        if (resolved) reachable(resolved);
      }
      ts.forEachChild(node, scan);
    };
    scan(sources.get(name));
  }
  entryFiles.forEach(reachable);
  const symbolOf = (node) => {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  };
  const limit = (values) => values && values.length <= 512 ? unique(values) : undefined;
  const joined = (parts) => parts.every(Boolean) ? limit(parts.flat()) : undefined;
  function literalType(type) {
    if (!type) return undefined;
    if (type.isStringLiteral() || type.isNumberLiteral()) return [String(type.value)];
    if (type.flags & ts.TypeFlags.BooleanLiteral) return [type.intrinsicName];
    if (type.isUnion()) return joined(type.types.filter((member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))).map(literalType));
    return undefined;
  }
  function returned(declaration) {
    if (!declaration?.body) return [];
    if (!ts.isBlock(declaration.body)) return [declaration.body];
    const values = [];
    const scan = (node) => {
      if (ts.isReturnStatement(node) && node.expression) values.push(node.expression);
      else if (node === declaration.body || !ts.isFunctionLike(node)) ts.forEachChild(node, scan);
    };
    scan(declaration.body);
    return values;
  }
  function callReturns(node) {
    const calleeName = ts.isIdentifier(node.expression) ? node.expression.text
      : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
    if (calleeName === 'useMemo' && node.arguments[0]
      && (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]))) return returned(node.arguments[0]);
    const signature = checker.getResolvedSignature(node);
    const symbol = symbolOf(node.expression);
    const declarations = uniqueNodes([signature?.declaration, ...(symbol?.declarations ?? [])]);
    return declarations.flatMap(returned);
  }
  function uniqueNodes(nodes) { return [...new Set(nodes.filter(Boolean))]; }
  function initializers(node) {
    const symbol = node.parent && ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent) : symbolOf(node);
    const values = (symbol?.declarations ?? []).flatMap((declaration) => declaration.initializer ? [declaration.initializer] : []);
    if (symbol) {
      for (const declaration of symbol.declarations ?? []) {
        const source = declaration.getSourceFile();
        const scan = (child) => {
          if (ts.isBinaryExpression(child) && child.operatorToken.kind === ts.SyntaxKind.EqualsToken && symbolOf(child.left) === symbol) values.push(child.right);
          ts.forEachChild(child, scan);
        };
        scan(source);
      }
    }
    return uniqueNodes(values);
  }
  function property(receiver, name, seen) {
    receiver = unwrap(receiver);
    if (!receiver || seen.has(receiver)) return undefined;
    const next = new Set(seen).add(receiver);
    if (ts.isObjectLiteralExpression(receiver)) {
      const member = receiver.properties.find((value) => value.name && (value.name.text ?? value.name.getText()) === name);
      if (member && ts.isPropertyAssignment(member)) return strings(member.initializer, next);
      if (member && ts.isShorthandPropertyAssignment(member)) return strings(member.name, next);
    }
    if (ts.isConditionalExpression(receiver)) return joined([property(receiver.whenTrue, name, next), property(receiver.whenFalse, name, next)]);
    if (ts.isIdentifier(receiver)) {
      const candidates = initializers(receiver);
      if (candidates.length) return joined(candidates.map((value) => property(value, name, next)));
    }
    if (ts.isCallExpression(receiver)) {
      const candidates = callReturns(receiver);
      if (candidates.length) return joined(candidates.map((value) => property(value, name, next)));
    }
    return undefined;
  }
  function strings(input, seen = new Set()) {
    const node = unwrap(input);
    if (!node || seen.has(node)) return undefined;
    const next = new Set(seen).add(node);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return [node.text];
    if (ts.isTemplateExpression(node)) {
      let values = [node.head.text];
      for (const span of node.templateSpans) {
        const replacements = strings(span.expression, next);
        if (!replacements) return undefined;
        values = limit(values.flatMap((prefix) => replacements.map((value) => prefix + value + span.literal.text)));
        if (!values) return undefined;
      }
      return values;
    }
    if (ts.isConditionalExpression(node)) return joined([strings(node.whenTrue, next), strings(node.whenFalse, next)]);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return joined([strings(node.left, next), strings(node.right, next)]);
    const typed = literalType(checker.getTypeAtLocation(node));
    if (typed?.length) return typed;
    if (ts.isIdentifier(node)) {
      const values = initializers(node);
      if (values.length) return joined(values.map((value) => strings(value, next)));
    }
    if (ts.isPropertyAccessExpression(node)) return property(node.expression, node.name.text, next);
    if (ts.isElementAccessExpression(node)) {
      const keys = strings(node.argumentExpression, next);
      if (keys) return joined(keys.map((key) => property(node.expression, key, next)));
    }
    if (ts.isCallExpression(node)) {
      const values = callReturns(node);
      if (values.length) return joined(values.map((value) => strings(value, next)));
    }
    return undefined;
  }
  const translationParameters = new Set();
  function translationReference(node) {
    node = unwrap(node);
    if (!node) return false;
    if ((ts.isIdentifier(node) && node.text === 't') || (ts.isPropertyAccessExpression(node) && node.name.text === 't')) return true;
    if (translationParameters.has(symbolOf(node))) return true;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'bind') return translationReference(node.expression.expression);
    return /^TFunction(?:<|$)/.test(checker.typeToString(checker.getTypeAtLocation(node)));
  }
  // Follow an actual translator passed to a helper. A parameter's name alone
  // (translate, label, etc.) never exempts its keys from the consumer audit.
  let propagated = true;
  while (propagated) {
    propagated = false;
    for (const filename of visited) {
      const scan = (node) => {
        if (ts.isCallExpression(node)) {
          const declaration = checker.getResolvedSignature(node)?.declaration;
          node.arguments.forEach((argument, index) => {
            const parameter = declaration?.parameters[index];
            if (parameter && translationReference(argument)) {
              const symbol = symbolOf(parameter.name);
              if (symbol && !translationParameters.has(symbol)) { translationParameters.add(symbol); propagated = true; }
            }
          });
        }
        ts.forEachChild(node, scan);
      };
      scan(sources.get(filename));
    }
  }
  const english = flattenLocale(en), hebrew = flattenLocale(he);
  const enKeys = Object.keys(english), heKeys = Object.keys(hebrew), used = new Set(), missing = new Set(), unresolved = [];
  function translationCall(node) {
    if (!ts.isCallExpression(node) || !node.arguments.length) return false;
    return translationReference(node.expression);
  }
  for (const filename of visited) {
    const source = sources.get(filename);
    const scan = (node) => {
      if (translationCall(node)) {
        const keys = strings(node.arguments[0]);
        if (!keys?.length) {
          const location = source.getLineAndCharacterOfPosition(node.getStart());
          unresolved.push({ file: filename, line: location.line + 1, expression: node.arguments[0].getText(source) });
        } else for (const key of keys) {
          if (Object.hasOwn(english, key)) used.add(key);
          else missing.add(key);
        }
      }
      ts.forEachChild(node, scan);
    };
    scan(source);
  }
  const interpolationMismatches = enKeys.filter((key) => Object.hasOwn(hebrew, key)
    && JSON.stringify(interpolationNames(english[key])) !== JSON.stringify(interpolationNames(hebrew[key])));
  const hebrewViolations = [];
  for (const [key, value] of Object.entries(hebrew)) {
    if (/\bSAF\b|timestamp/i.test(value)) hebrewViolations.push({ key, reason: 'technical English term' });
    const rendered = value.replace(/{{\s*-?\s*[\w.]+(?:\s*,[^{}]+)?\s*}}/g, '42');
    if (/[{}]|<\/?[A-Za-z][^>]*>|%[sdif]/.test(rendered)) hebrewViolations.push({ key, reason: 'unresolved placeholder or markup' });
  }
  const result = { usedKeys: unique([...used]), unusedKeys: enKeys.filter((key) => !used.has(key)).sort(), missingKeys: unique([...missing]),
    missingHebrewKeys: enKeys.filter((key) => !Object.hasOwn(hebrew, key)).sort(), extraHebrewKeys: heKeys.filter((key) => !Object.hasOwn(english, key)).sort(),
    unresolvedCalls: unresolved, interpolationMismatches, hebrewViolations, visitedFiles: unique([...visited]) };
  return { ...result, ok: !result.unusedKeys.length && !result.missingKeys.length && !result.missingHebrewKeys.length && !result.extraHebrewKeys.length
    && !result.unresolvedCalls.length && !result.interpolationMismatches.length && !result.hebrewViolations.length };
}

function auditProject(root = process.cwd()) {
  const files = {};
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(filename);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files[filename] = fs.readFileSync(filename, 'utf8');
    }
  }
  collect(path.join(root, 'src'));
  const app = path.join(root, 'App.tsx'); files[app] = fs.readFileSync(app, 'utf8');
  return auditI18nSources({ files, entryFiles: [app], en: JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8')),
    he: JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/he.json'), 'utf8')) });
}

module.exports = { auditI18nSources, auditProject, flattenLocale, interpolationNames };
if (require.main === module) {
  const report = auditProject();
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + '\n');
  else process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.ok ? 0 : 1;
}
