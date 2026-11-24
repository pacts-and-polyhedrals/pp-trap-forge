import test from "node:test";
import assert from "node:assert/strict";
import {CATALOG} from "../scripts/catalog.mjs";
import {
  TRAPWRIGHT_SPECIALIZATIONS,
  TRAPWRIGHT_ASSIGNMENTS,
  getTrapwrightAssignment,
  canUseTrapwrightPreset,
  getTrapwrightPresets
} from "../scripts/trapwright-catalog.mjs";

const specialize = Object.keys(TRAPWRIGHT_SPECIALIZATIONS);
const unlockLevels = new Set([3, 5, 11, 17]);

test("all 86 catalog entries appear exactly once, without unknown names or duplicates", () => {
  const full = specialize.flatMap(id => getTrapwrightPresets(id, 20));
  const names = full.map(p => p.name);
  assert.equal(CATALOG.length, 86);
  assert.equal(names.length, CATALOG.length);
  assert.equal(new Set(names).size, CATALOG.length);
  assert.deepEqual([...names].sort(), CATALOG.map(p => p.name).sort());
  assert.deepEqual(Object.keys(TRAPWRIGHT_ASSIGNMENTS).sort(), [...names].sort());
  assert.deepEqual(specialize.map(id => getTrapwrightPresets(id, 20).length), [22, 22, 21, 21]);
});

test("class-level gating and every cross-specialization denial are consistent", () => {
  for (const preset of CATALOG) {
    const {subclass, minLevel} = getTrapwrightAssignment(preset.name);
    assert.ok(unlockLevels.has(minLevel));
    for (const id of specialize) {
      for (const level of [0, 1, 2, 3, 4, 5, 10, 11, 16, 17, 19, 20]) {
        const expected = id === subclass && level >= minLevel;
        assert.equal(canUseTrapwrightPreset(id, level, preset.name), expected, preset.name + " at " + level + " " + id);
        assert.equal(getTrapwrightPresets(id, level).some(p => p.name === preset.name), expected);
      }
    }
  }
});

test("known niches keep their characteristic traps and unlock tiers", () => {
  const expected = {
    "Pressure Plate Pit": ["ironwork", 5],
    "Wall Flame Jet": ["ironwork", 5],
    "Glyph of Flame": ["sigil", 11],
    "Summoning Circle": ["sigil", 17],
    "Razorvine Patch": ["wildway", 3],
    "Lava Vent": ["wildway", 17],
    "Door With Teeth": ["maw", 5],
    "Living Hallway": ["maw", 17]
  };
  for (const [name, [subclass, minLevel]] of Object.entries(expected)) {
    assert.deepEqual(getTrapwrightAssignment(name), {subclass, minLevel});
  }
  for (const id of specialize) {
    assert.deepEqual(new Set(getTrapwrightPresets(id, 20).map(p => getTrapwrightAssignment(p.name).minLevel)), unlockLevels);
  }
});

test("unsupported keys, fake data and malformed levels cannot create access; rules are immutable", () => {
  for (const badName of ["__proto__", "constructor", "toString", "made-up", null, ["Net Drop"]]) {
    assert.equal(getTrapwrightAssignment(badName), undefined);
    assert.equal(canUseTrapwrightPreset("ironwork", 20, badName), false);
  }
  for (const badSub of ["__proto__", "constructor", "ironwork-engineer", "Ironwork", null, ["ironwork"]]) {
    assert.equal(canUseTrapwrightPreset(badSub, 20, "Net Drop"), false);
    assert.deepEqual(getTrapwrightPresets(badSub, 20), []);
  }
  for (const badLevel of [20.5, 21, -1, "20", true, Infinity, NaN]) {
    assert.equal(canUseTrapwrightPreset("ironwork", badLevel, "Net Drop"), false);
    assert.deepEqual(getTrapwrightPresets("ironwork", badLevel), []);
  }
  assert.throws(() => { getTrapwrightAssignment("Net Drop").minLevel = 1; }, TypeError);
  assert.throws(() => { TRAPWRIGHT_ASSIGNMENTS["Net Drop"] = null; }, TypeError);
  assert.throws(() => { getTrapwrightPresets("ironwork", 20)[0].name = "Not the original"; }, TypeError);
});
