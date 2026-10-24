import { test } from "node:test";
import assert from "node:assert/strict";
import { typed, shown } from "./browser-prefs.js";

test("valor da opção vira o tipo da pref", () => {
  assert.equal(typed("boolean", "true"), true);
  assert.equal(typed("boolean", "false"), false);
  assert.equal(typed("number", "5"), 5);
  assert.equal(typed(undefined, "abc"), "abc");
});

test("valor da pref vira o data-value da opção", () => {
  assert.equal(shown(false), "false");
  assert.equal(shown(1), "1");
});
