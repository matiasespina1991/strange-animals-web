import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const handlers = {};
const makeNode = () => ({ children: [], attributes: {}, append(node) { this.children.push(node); }, addEventListener(type, fn) { this[type] = fn; }, setAttribute(name, value) { this.attributes[name] = value; } });
const list = makeNode();
list.querySelectorAll = () => list.children.map(item => item.children[0]);
const status = makeNode();
const parent = {};
let initialized = 0;
let selected = 0;
let audioError;
const context = {
  location: { origin: 'http://localhost:5173' }, parent,
  window: { addEventListener: (name, fn) => { handlers[name] = fn; } },
  document: { createElement: makeNode, getElementById: id => id === 'tracks' ? list : status },
  console: { error() {} },
  Amplitude: {
    init(config) { initialized++; config.callbacks.initialized(); },
    getActiveIndex: () => selected,
    playSongAtIndex: index => { selected = index; },
    getAudio: () => ({ addEventListener: (_, fn) => { audioError = fn; }, error: { code: 4 } }),
  },
};
vm.runInNewContext(readFileSync('public/experiments/myspace-player/player.js', 'utf8'), context);
const data = { type: 'myspace-release', songs: [{ name: '<b>Not markup</b>', artist: 'Artist' }, { name: 'Second', artist: 'Other' }] };
handlers.message({ origin: 'https://untrusted.test', source: parent, data });
handlers.message({ origin: context.location.origin, source: {}, data });
assert.equal(initialized, 0);
handlers.message({ origin: context.location.origin, source: parent, data });
assert.equal(initialized, 1);
assert.equal(list.children.length, 2);
assert.equal(list.children[0].children[0].textContent, '1. Artist — <b>Not markup</b>');
list.children[1].children[0].click();
assert.equal(selected, 1);
handlers.message({ origin: context.location.origin, source: parent, data });
assert.equal(initialized, 1, 'Duplicate messages must not initialize a second audio player');
audioError();
assert.match(status.textContent, /Could not play/);
console.log('MySpace controller: origin/source checks, playlist, safe text, playback selection, single initialization and error state passed.');
