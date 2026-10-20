import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const data = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const categoriesUrl = data(compile(await readFile(new URL("../src/features/identity/font-categories.ts", import.meta.url), "utf8")));
const { FONT_PARENT_CATEGORIES, compareFontSectionCategoryLabels, getFontCategoryDisplayName } = await import(categoriesUrl);
const catalogCode = compile(await readFile(new URL("../src/features/identity/font-picker-catalog.ts", import.meta.url), "utf8"))
  .replace('"./font-categories"', JSON.stringify(categoriesUrl));
const { pickerCatalog, pickerCategories, pickerCategory } = await import(data(catalogCode));
const fonts = [
  { id: "s", name: "Zulu", parentCategory: "Paragraph / Standard" },
  { id: "c", name: "Narrow", parentCategory: "Condensed / Narrow" },
  { id: "a2", name: "Abstract 10", parentCategory: "Abstract" },
  { id: "a1", name: "Abstract 2", parentCategory: "Abstract" },
  { id: "l", name: "LCD", parentCategory: "LCD Display" },
  { id: "n", name: "Nón-Latin", parentCategory: "Non-Latin Script" },
  { id: "u", name: "Ungrouped" },
];
assert.deepEqual(pickerCatalog(fonts, "standard", [], "").map((font) => font.id), ["s", "c"]);
assert.deepEqual(pickerCatalog(fonts, "all", [], "").map((font) => font.id), ["a1", "a2", "l", "s", "c", "n", "u"]);
assert.deepEqual(pickerCatalog(fonts, "favorites", ["n", "a2"], "").map((font) => font.id), ["a2", "n"]);
assert.deepEqual(pickerCatalog(fonts, "standard", [], "non latin").map((font) => font.id), ["n"], "Standard search must find other categories");
assert.deepEqual(pickerCatalog(fonts, "favorites", ["s"], "abstract"), [], "Favorites search must not leak non-favorites");
const available = pickerCatalog(fonts, "all", [], "");
assert.deepEqual(available.filter((font) => pickerCategory(font) === "Abstract").map((font) => font.id), ["a1", "a2"]);
assert.equal(pickerCategory(fonts.at(-1)), "Uncategorized");
assert.equal(getFontCategoryDisplayName("LCD Display"), "LCD/LED Display");
assert.equal(getFontCategoryDisplayName("Non-Latin Script"), "Non-Latin / 日本語");
assert.deepEqual(pickerCategories([], "Goth"), ["Goth"], "An active empty filter must remain removable");
assert.deepEqual([...FONT_PARENT_CATEGORIES].reverse().sort(compareFontSectionCategoryLabels), [...FONT_PARENT_CATEGORIES]);
console.log("Font catalogue: shared category order, grouping, Standard, search, Favorites, active filters and labels passed.");
