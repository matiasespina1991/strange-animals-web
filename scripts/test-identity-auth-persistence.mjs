import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const policy = [];
const idb = {}, local = {}, popup = {};
function initializeRoute() {
  const exports = {};
  vm.runInNewContext(compile('src/lib/firebase.ts'), { exports, require: name => {
    if (name === 'firebase/app') return { initializeApp: () => ({ name: '[DEFAULT]' }) };
    if (name === 'firebase/auth') return {
      indexedDBLocalPersistence: idb, browserLocalPersistence: local, browserPopupRedirectResolver: popup,
      initializeAuth: (app, options) => { policy.push(options); return { app }; },
    };
    if (name === 'firebase/firestore') return { getFirestore() {} };
    if (name === 'firebase/storage') return { getStorage() {} };
    return {};
  } });
  return exports;
}
const editor = initializeRoute();
initializeRoute(); // A public model page initializes exactly the same module.
assert.deepEqual([...policy[0].persistence], [idb, local]);
assert.deepEqual([...policy[1].persistence], [idb, local]);
assert.equal(policy[0].popupRedirectResolver, popup);
const effects = [], states = [];
let callback, authError, removed = false;
const exports = {};
vm.runInNewContext(compile('src/features/identity/IdentityAccessGate.tsx'), { exports, require: name => {
  if (name === '@/lib/firebase') return editor;
  if (name === 'react') return {
    useEffect: fn => effects.push(fn), useState: initial => [initial, value => states.push(value)],
  };
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
  if (name === 'firebase/auth') return {
    onAuthStateChanged: (auth, next, error) => {
      assert.equal(auth, editor.firebaseAuth);
      callback = next; authError = error;
      return () => { removed = true; };
    },
    setPersistence: () => { throw Error('Routes must never change persistence'); },
  };
  throw Error(name);
} });
exports.IdentityAccessGate({ children: 'editor' });
const cleanup = effects[0]();
callback({ email: 'identity-access@strangeanimals.de' });
assert.equal(states.at(-1), 'authorized');
callback({ email: 'other@example.test' });
assert.equal(states.at(-1), 'signed-out', 'Access control is not bypassed');
callback(null);
assert.equal(states.at(-1), 'signed-out');
authError(Error('auth unavailable'));
assert.equal(states.at(-1), 'signed-out');
cleanup();
assert.ok(removed);
const before = states.length;
callback({ email: 'identity-access@strangeanimals.de' });
assert.equal(states.length, before, 'Unmounted listener cannot update state');
assert.doesNotMatch(readFileSync('src/features/identity/IdentityAccessGate.tsx', 'utf8'), /setPersistence/);
assert.match(readFileSync('src/features/identity/account-auth.ts', 'utf8'), /identity-account/);
console.log('Identity auth: one persistence hierarchy across routes, no route migration, account isolation, authorization and listener cleanup passed.');
