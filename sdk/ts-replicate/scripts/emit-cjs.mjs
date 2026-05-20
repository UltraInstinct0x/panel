// emit a tiny cjs shim for require()-based consumers.
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

const cjs = `'use strict';
// cjs shim for panel-replicate-adapter. forwards to esm via dynamic import.
const _esm = import('./index.js');
module.exports = new Proxy({}, {
  get(_t, prop) {
    return (...args) => _esm.then(m => m[prop](...args));
  },
});
module.exports.default = module.exports;
`;
writeFileSync('dist/index.cjs', cjs);
console.log('wrote dist/index.cjs');
