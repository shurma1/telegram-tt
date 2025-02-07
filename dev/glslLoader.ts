import fs from 'fs';
import path from 'path';

interface ImportItem {
  key: string;
  target: string;
  content: string;
}

type Loader = {
  resolve: (context: string, request: string, callback: (err: Error | null, resolved?: string) => void) => void;
  addDependency: (dependency: string) => void;
  cacheable: () => void;
  async: () => (err: Error | null, result?: string) => void;
  context: string;
};

type Callback = (err: Error | null, result?: string) => void;

const parse = (
  loader: Loader,
  source: string,
  context: string,
  cb: Callback,
): void => {
  const imports: ImportItem[] = [];
  const importPattern = /#include "([./\w_-]+)"/gi; // Убрал лишний escape-символ
  let match = importPattern.exec(source);

  // eslint-disable-next-line no-null/no-null
  while (match !== null) {
    imports.push({
      key: match[1],
      target: match[0],
      content: '',
    });
    match = importPattern.exec(source);
  }

  processImports(loader, source, context, imports, cb);
};

function processImports(
  loader: Loader,
  source: string,
  context: string,
  imports: ImportItem[],
  cb: Callback,
): void { // Указал возвращаемый тип void
  if (imports.length === 0) {
    // eslint-disable-next-line no-null/no-null
    cb(null, source);
    return;
  }

  const imp = imports.pop() as ImportItem;

  loader.resolve(context, imp.key, (resolveErr, resolved) => {
    if (resolveErr) {
      cb(resolveErr);
      return;
    }

    if (resolved) {
      loader.addDependency(resolved);
      fs.readFile(resolved, 'utf-8', (readErr, src) => {
        if (readErr) {
          cb(readErr);
          return;
        }

        parse(loader, src, path.dirname(resolved), (parseErr, bld) => {
          if (parseErr) {
            cb(parseErr);
            return;
          }

          source = source.replace(imp.target, bld as string);
          processImports(loader, source, context, imports, cb);
        });
      });
    }
  });
}

export default function webpackGlslLoader(this: Loader, source: string) {
  this.cacheable();
  const cb = this.async();
  parse(this, source, this.context, (err, bld) => {
    if (err) {
      cb(err);
      return;
    }

    // eslint-disable-next-line no-null/no-null
    cb(null, `module.exports = ${JSON.stringify(bld)}`);
  });
}
