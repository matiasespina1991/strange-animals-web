import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const source = (name) => readFile(new URL(`../src/features/identity/${name}`, import.meta.url), "utf8");
const cleanups = [];
globalThis.__previewTestCleanup = cleanups;
const hooks = url(`export const useId=()=>"palette"; export const useRef=(value)=>({current:value}); export const useState=(value)=>[value,()=>{}]; export const useLayoutEffect=()=>{}; export const useEffect=(effect)=>{const cleanup=effect();if(cleanup)globalThis.__previewTestCleanup.push(cleanup)};`);
const icons = url(`export const Check=()=>null;export const Plus=()=>null;`);
const code = compile(await source("ColorSwatches.tsx"))
  .replace('"react"', JSON.stringify(hooks))
  .replace('"lucide-react"', JSON.stringify(icons))
  .replace('"./color-swatch-capacity"', JSON.stringify(url(compile(await source("color-swatch-capacity.ts")))))
  .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
const { ColorSwatches } = await import(url(code));
const previews = [], choices = [];
const tree = ColorSwatches({ colors: ["#000000"], label: "Ink", onPreview: (color) => previews.push(color), onChoose: (color) => choices.push(color) });
const button = tree.props.children[0].props.children[0];
button.props.onPointerEnter({ pointerType: "mouse" });
assert.deepEqual(previews, ["#000000"]);
assert.deepEqual(choices, [], "Hover must not commit or trigger a confirmation");
button.props.onPointerLeave();
assert.equal(previews.at(-1), null);
button.props.onClick();
assert.deepEqual(choices, ["#000000"]);
assert.equal(previews.at(-1), null);
cleanups.forEach((cleanup) => cleanup());

const expandedColors = ColorSwatches({
  colors: ["#000000", "#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
  visibleCount: 5,
  label: "Ink color",
  onChoose: () => {},
});
assert.equal(expandedColors.props.children[0].props.children.length, 5, "Ink can show two more swatches inline");
assert.equal(expandedColors.props.children[1].props["aria-label"], "More ink color options");

const appMock = url(`export const getApps=()=>[];export const initializeApp=(options,name)=>({name,options});`);
const authMock = url(`export const getAuth=(app)=>({app});`);
const baseMock = url(`export const firebaseApp={name:"[DEFAULT]",options:{projectId:"test"}};`);
const authCode = compile(await source("account-auth.ts"))
  .replace('"firebase/app"', JSON.stringify(appMock))
  .replace('"firebase/auth"', JSON.stringify(authMock))
  .replace('"@/lib/firebase"', JSON.stringify(baseMock));
const { accountAuth, accountError } = await import(url(authCode));
assert.equal(accountAuth.app.name, "identity-account", "Personal auth must not replace the access-key app session");
assert.equal(accountAuth.app.options.projectId, "test");
assert.match(accountError({ code: "auth/invalid-credential" }), /email and password/);
assert.match(accountError({ code: "auth/unauthorized-domain" }), /authorized/);
assert.match(accountError({ code: "auth/operation-not-allowed" }), /enabled/);
assert.ok(!accountError(new Error("sensitive data")).includes("sensitive data"));
delete globalThis.__previewTestCleanup;
const modelUrl = url(compile(await source("design-configurator-model.ts")));
const dirtyCode = compile(await source("project-dirty-state.ts")).replace('"./design-configurator-model"', JSON.stringify(modelUrl));
const { hasUnsavedProject } = await import(url(dirtyCode));
const { initialDesign, parseDesign } = await import(modelUrl);
assert.equal(hasUnsavedProject(initialDesign), false);
assert.equal(hasUnsavedProject(parseDesign(initialDesign)), false, "Normalized defaults must not trigger confirmation");
assert.equal(hasUnsavedProject({ ...initialDesign, title: "Changed" }), true);
assert.equal(hasUnsavedProject({ ...initialDesign, title: "Saved" }, JSON.stringify({ ...initialDesign, title: "Saved" })), false);
console.log("Previews/auth: hover vs commit, reset on leave, independent auth app and safe error messages passed (mocked SDK).");
