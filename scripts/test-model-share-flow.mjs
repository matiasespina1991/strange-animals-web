import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('src/features/identity/Sleeve3DPreview.tsx', 'utf8');
const code = source.slice(source.indexOf('  const shareModel = async'), source.indexOf('  const resetView =')).replaceAll('import.meta.env.DEV', 'false');
assert.doesNotMatch(source, /about:blank|previewWindow|pendingShareWindow|dc-3d-share-ready|dc-3d-share-status/);
function setup(user, failure = false) {
  const calls = [];
  const context = {
    accountAuth: { currentUser: user }, shareUrl: null, shareInFlight: { current: false },
    window: { location: { origin: 'https://example.test' }, open: (...args) => calls.push(['open', ...args]) },
    Blob, File, Error, Math, console,
    exportModel: async () => { calls.push('export'); return new Blob(['glb']); },
    createModelShare: async () => { calls.push('upload'); if (failure) throw Error('Upload failed'); return { id: 'ready-model' }; },
  };
  for (const name of ['setShareError', 'setSignInOpen', 'setSharing', 'setSharePhase', 'setCopyStatus', 'setUploadProgress']) context[name] = value => calls.push([name, value]);
  context.setShareUrl = value => { context.shareUrl = value; calls.push(['ready', value]); };
  vm.createContext(context);
  vm.runInContext(code + '\nglobalThis.run = shareModel;', context);
  return { context, calls };
}
const guest = setup(null);
await guest.context.run();
assert.ok(guest.calls.some(([key, value]) => key === 'setSignInOpen' && value === true));
assert.ok(!guest.calls.includes('export'));
assert.ok(!guest.calls.some(call => call[0] === 'open'), 'No tab before authentication');
guest.context.accountAuth.currentUser = { uid: 'owner' };
await guest.context.run();
assert.equal(guest.context.shareUrl, 'https://example.test/ready-model');
assert.equal(guest.context.shareInFlight.current, false);
assert.equal(guest.calls.at(-2)[0], 'open', 'Open only after URL is ready');
await guest.context.run();
assert.equal(guest.calls.filter(value => value === 'upload').length, 1, 'Ready link reused instead of uploading twice');
assert.equal(guest.calls.filter(call => call[0] === 'open').length, 2, 'Share opens the same link again');
assert.ok(guest.calls.filter(call => call[0] === 'open').every(call => call[1] === 'https://example.test/ready-model' && call[3] === 'noopener,noreferrer'));
const failed = setup({ uid: 'owner' }, true);
await failed.context.run();
assert.equal(failed.context.shareUrl, null);
assert.equal(failed.context.shareInFlight.current, false);
assert.ok(failed.calls.some(([key, value]) => key === 'setShareError' && value === 'Upload failed'));
assert.ok(!failed.calls.some(call => call[0] === 'open'), 'Failed uploads never open a tab');
console.log('Share: auth before export, opens completed link, reopens without reuploading, no blank tabs or duplicate progress/card, recoverable errors passed.');
