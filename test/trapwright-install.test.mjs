import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { installTrapwrightKit, parseTrapwrightRules } from "../scripts/trapwright-install.mjs";

const rulesText = await readFile(new URL("../trapwright/TRAPWRIGHT.md", import.meta.url), "utf8");
const scope = "pp-trap-forge";

function environment(options = {}) {
  const items = new Map(), folders = new Map(), user = { id: "owner", isGM: true };
  const world = { user, users: { activeGM: user }, system: { id: "dnd5e", version: "6.1.4" }, items, folders };
  let seq = 1, errors = Number(options.failAt || 0), itemWrites = 0;
  function maker(collection, prefix) {
    return { create: async source => {
      if (prefix === "Item" && ++itemWrites === errors) throw new Error("Injected creation failure");
      const id = String(seq++).padStart(16, "0");
      const data = structuredClone(source);
      const doc = { id, uuid: `${prefix}.${id}`, ...data };
      doc.toObject = () => structuredClone(data);
      collection.set(id, doc);
      return doc;
    } };
  }
  return { world, ItemDocument: maker(items, "Item"), FolderDocument: maker(folders, "Folder"), rulesText };
}

const readAdv = doc => Object.values(doc.system.advancement);
const docAt = (env, uuid) => env.world.items.get(uuid.slice("Item.".length));

test("parses shipped rules and all 33 feature entries without raw HTML injection", () => {
  const parsed = parseTrapwrightRules(rulesText);
  assert.equal(parsed.features.length, 33);
  assert.equal(parsed.sections.trapwright.features.length, 13);
  for (const spec of ["ironwork", "sigil", "wildway", "maw"]) {
    assert.deepEqual(parsed.sections[spec].features.map(f => f.level), [3, 6, 10, 14, 18]);
  }
  assert.match(parsed.description, /<table>/);
  const unsafe = parseTrapwrightRules(rulesText.replace("## Class Features", "## Class Features\n<img src=x onerror=alert(1)>"));
  assert.doesNotMatch(unsafe.description, /<img/);
  assert.match(unsafe.description, /&lt;img/);
});

test("installs native v6 level-up links, canonical integration flags and player-readable world Items", async () => {
  const env = environment();
  const result = await installTrapwrightKit(env);
  assert.equal(result.created, 38);
  assert.equal(result.reused, 0);
  assert.equal(env.world.folders.size, 1);
  assert.equal(env.world.items.size, 38);
  const klass = docAt(env, result.classUuid);
  assert.equal(klass.type, "class");
  assert.equal(klass.system.identifier, "trapwright");
  assert.deepEqual(klass.system.primaryAbility.value, ["int"]);
  assert.equal(klass.system.hd.denomination, "d8");
  assert.equal(klass.system.source.rules, "2024");
  assert.match(klass.system.description.value, /Practice Schematics/);
  const classAdv = readAdv(klass);
  assert.equal(classAdv.filter(a => a.type === "HitPoints").length, 1);
  assert.equal(classAdv.find(a => a.type === "Subclass").level, 3);
  assert.deepEqual(classAdv.filter(a => a.type === "AbilityScoreImprovement").map(a => a.level), [4, 8, 12, 16, 19]);
  assert.equal(classAdv.find(a => a.name === "Epic Boon").configuration.points, 2);
  assert.equal(klass.system.wealth, "125");
  assert.deepEqual(readAdv(docAt(env, result.subclassUuids.ironwork)).find(a => a.type === "Trait").configuration.choices[0].pool,
    ["tool:art:smith", "tool:art:mason"]);
  assert.deepEqual(classAdv.find(a => a.name === "Skill Proficiencies").configuration.choices[0].pool, [
    "skills:acr", "skills:arc", "skills:inv", "skills:nat", "skills:prc", "skills:slt", "skills:ste", "skills:sur"
  ]);
  const subclassKeys = ["ironwork", "sigil", "wildway", "maw"];
  assert.deepEqual(Object.keys(result.subclassUuids), subclassKeys);
  for (const key of subclassKeys) {
    const subclass = docAt(env, result.subclassUuids[key]);
    assert.equal(subclass.type, "subclass");
    assert.equal(subclass.system.identifier, key);
    assert.equal(subclass.system.classIdentifier, "trapwright");
    assert.deepEqual(readAdv(subclass).filter(a => a.type === "ItemGrant").map(a => a.level), [3, 6, 10, 14, 18]);
    const prof = readAdv(subclass).find(a => a.type === "Trait");
    assert.equal(prof.level, 3);
    assert.equal(prof.configuration.allowReplacements, true);
  }
  for (const uuid of [result.classUuid, ...Object.values(result.subclassUuids)]) {
    const doc = docAt(env, uuid);
    assert.equal(doc.flags[scope].twContent.origin, "trapwright");
    for (const [_id, a] of Object.entries(doc.system.advancement)) {
      assert.match(_id, /^[a-z\d]{16}$/i);
      assert.equal(_id, a._id);
      if (a.type !== "ItemGrant") continue;
      for (const entry of a.configuration.items) {
        const feature = docAt(env, entry.uuid);
        assert.equal(feature.type, "feat");
        assert.equal(feature.system.prerequisites.level, a.level);
        assert.equal(feature.ownership.default, 2);
        assert.ok(Object.values(result.featureUuids).includes(entry.uuid));
      }
    }
  }
  assert.ok(!result.notes.some(note => note.includes("lacks")));
});

test("rejects non-active GM, wrong system or malformed rules before creating any source or folder", async () => {
  const env = environment();
  env.world.users.activeGM = { id: "other" };
  assert.throws(() => installTrapwrightKit(env), /active GM/);
  env.world.users.activeGM = env.world.user;
  env.world.system.version = "5.3.0";
  await assert.rejects(installTrapwrightKit(env), /6\.0 or later/);
  env.world.system.version = "7.0.0";
  await assert.rejects(installTrapwrightKit({ ...env, rulesText: "invalid markdown" }), /level 1 and 20/);
  env.world.system.version = "6.1.0";
  await assert.rejects(installTrapwrightKit({ ...env, rulesText: "invalid markdown" }), /level 1 and 20/);
  assert.equal(env.world.folders.size, 0);
  assert.equal(env.world.items.size, 0);
});

test("refuses colliding unmarked source instead of adopting or changing it", async () => {
  const env = environment();
  const existing = { id: "user", name: "My Trapwright", type: "class", system: { identifier: "trapwright" } };
  env.world.items.set(existing.id, existing);
  await assert.rejects(installTrapwrightKit(env), /unmarked/);
  assert.equal(env.world.folders.size, 0);
  assert.deepEqual([...env.world.items.values()], [existing]);
});

test("retries creation failures and repeated installs without duplicate or moved world Items", async () => {
  const env = environment({ failAt: 3 });
  await assert.rejects(installTrapwrightKit(env), /Injected creation failure/);
  assert.equal(env.world.items.size, 2);
  assert.equal(env.world.folders.size, 1);
  const first = await installTrapwrightKit(env);
  assert.equal(first.created, 36);
  assert.equal(first.reused, 2);
  const second = await installTrapwrightKit(env);
  assert.equal(second.created, 0);
  assert.equal(second.reused, 38);
  assert.equal(second.folderUuid, first.folderUuid);
  assert.deepEqual(second.featureUuids, first.featureUuids);
  assert.deepEqual(second.subclassUuids, first.subclassUuids);
});

test("uses one same-client install in flight and loads only the bundled rules", async () => {
  const env = environment();
  delete env.rulesText;
  const load = async (url, opts) => {
    assert.ok(url.pathname.endsWith("/trapwright/TRAPWRIGHT.md"));
    assert.equal(opts.credentials, "same-origin");
    assert.equal(opts.redirect, "error");
    return { ok: true, text: async () => rulesText };
  };
  const promises = [installTrapwrightKit({ ...env, load }), installTrapwrightKit({ ...env, load })];
  assert.equal(promises[0], promises[1]);
  const [first, second] = await Promise.all(promises);
  assert.equal(first.created, 38);
  assert.deepEqual(first, second);
});

test("warns on stale links when a source feature was deleted and recreated, never rewriting the source", async () => {
  const env = environment();
  const first = await installTrapwrightKit(env);
  const deletedKey = "feature:ironwork:3:hold-the-line";
  const deleted = docAt(env, first.featureUuids[deletedKey]);
  env.world.items.delete(deleted.id);
  const next = await installTrapwrightKit(env);
  assert.equal(next.created, 1);
  assert.equal(next.reused, 37);
  assert.notEqual(next.featureUuids[deletedKey], first.featureUuids[deletedKey]);
  assert.ok(next.notes.some(note => note.startsWith("Ironwork Engineer lacks")));
  assert.equal(readAdv(docAt(env, first.subclassUuids.ironwork))[0].configuration.items[0].uuid, deleted.uuid);
});
