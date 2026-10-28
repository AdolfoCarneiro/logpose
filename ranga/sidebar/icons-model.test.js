import { test } from "node:test";
import assert from "node:assert/strict";
import { ICON_CHOICES, iconChoices } from "./icons-model.js";
import { glyph } from "./kurobe/icons.mjs";

test("todo ícone da grade existe no Lucide", () => {
  assert.deepEqual(ICON_CHOICES.filter((name) => !glyph(name)), []);
  assert.equal(new Set(ICON_CHOICES).size, ICON_CHOICES.length);
});

test("o ícone atual fora da grade aparece primeiro", () => {
  assert.equal(iconChoices("box")[0], "box");
  assert.equal(iconChoices("heart"), ICON_CHOICES);
  assert.equal(iconChoices(undefined), ICON_CHOICES);
});
