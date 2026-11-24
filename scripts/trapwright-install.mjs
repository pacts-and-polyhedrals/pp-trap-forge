const SCOPE = "pp-trap-forge";
const ORIGIN = "trapwright";
const FOLDER_NAME = "Trapwright Class Kit";
const ART = "modules/pp-trap-forge/assets/trap.svg";
const RULES = new URL("../trapwright/TRAPWRIGHT.md", import.meta.url);
const SUBCLASSES = Object.freeze({
  ironwork: "Ironwork Engineer",
  sigil: "Sigil Binder",
  wildway: "Wildway Warden",
  maw: "Mawkeeper"
});
const SUB_LEVELS = [3, 6, 10, 14, 18];
const ASI_LEVELS = [4, 8, 12, 16];
let pending;

function abort(message) {
  throw new Error(`Trapwright: ${message}`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function inline(s) {
  return escapeHtml(s)
    .replace(/!?(\[([^\]]+)\])\([^\n)]+\)/g, "$2")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[ (])\*([^*]+)\*/g, "$1<em>$2</em>");
}

// Only emit a fixed set of elements; all input text is escaped, including raw HTML.
function html(markdown) {
  const out = [];
  let buffer = [], mode;
  function flush() {
    if (!buffer.length) return;
    if (mode === "ul" || mode === "ol") {
      out.push(`<${mode}>${buffer.map(v => `<li>${inline(v)}</li>`).join("")}</${mode}>`);
    } else if (mode === "table") {
      const rows = buffer.filter(line => !/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(line))
        .map(line => line.replace(/^\|\s*|\s*\|$/g, "").split("|").map(v => v.trim()));
      if (rows.length) {
        const row = (cells, tag) => `<tr>${cells.map(v => `<${tag}>${inline(v)}</${tag}>`).join("")}</tr>`;
        out.push(`<table><thead>${row(rows[0], "th")}</thead>${rows.length > 1 ? `<tbody>${rows.slice(1).map(v => row(v, "td")).join("")}</tbody>` : ""}</table>`);
      }
    } else out.push(`<p>${inline(buffer.join(" "))}</p>`);
    buffer = [];
  }
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flush();
      const tag = `h${Math.min(6, Math.max(2, h[1].length))}`;
      out.push(`<${tag}>${inline(h[2])}</${tag}>`);
      continue;
    }
    if (/^---+$/.test(line)) {
      flush();
      out.push("<hr>");
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.+)$/), ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const kind = bullet ? "ul" : ordered ? "ol" : /^\|.*\|$/.test(line) ? "table" : "p";
    if (kind !== mode) flush();
    mode = kind;
    buffer.push(bullet?.[1] ?? ordered?.[1] ?? line);
  }
  flush();
  return out.join("");
}

const delimiters = /^(?:Level\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+Level)\s*[:—–-]\s*(.+?)\s*$/i;
const idify = name => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Reads the definitive originals in the bundled rulebook, so rules and Item text cannot drift.
 * A direct rulesText injection is supported for local tests (not used by the module UI).
 */
export function parseTrapwrightRules(rulesText) {
  if (typeof rulesText !== "string" || !rulesText.trim()) abort("the bundled rulebook is empty.");
  const sections = Object.fromEntries([ORIGIN, ...Object.keys(SUBCLASSES)].map(key => [key, {
    intro: [], features: []
  }]));
  let scope = null, feature = null;
  for (const line of rulesText.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const heading = line.match(/^(#{2,3})\s+(.+)\s*$/);
    if (heading?.[1] === "##") {
      feature = null;
      const name = heading[2].trim().toLowerCase();
      scope = Object.entries(SUBCLASSES).find(([, title]) => name.includes(title.toLowerCase()))?.[0]
        ?? (/class features|trapwright features|^progression$/.test(name) ? ORIGIN : null);
      continue;
    }
    if (heading?.[1] === "###" && scope) {
      const parsed = heading[2].match(delimiters);
      if (parsed) {
        const level = Number(parsed[1] ?? parsed[2]), name = parsed[3].trim(), slug = idify(name);
        if (level < 1 || level > 20 || !slug) abort(`invalid feature heading "${heading[2]}".`);
        feature = { key: `feature:${scope}:${level}:${slug}`, scope, level, name, slug, lines: [] };
        sections[scope].features.push(feature);
        continue;
      }
      feature = null;
    }
    if (feature) feature.lines.push(line);
    else if (scope) sections[scope].intro.push(line);
  }
  const features = Object.values(sections).flatMap(section => section.features);
  if (!sections[ORIGIN].features.some(f => f.level === 1) || !sections[ORIGIN].features.some(f => f.level === 20)) {
    abort("could not find the level 1 and 20 Trapwright features in the bundled rulebook.");
  }
  for (const [key, title] of Object.entries(SUBCLASSES)) {
    for (const level of SUB_LEVELS) {
      if (!sections[key].features.some(f => f.level === level)) abort(`could not find the level ${level} feature for ${title}.`);
    }
  }
  if (new Set(features.map(f => f.key)).size !== features.length) abort("the rulebook contains duplicate feature definitions.");
  for (const f of features) {
    f.html = html(f.lines.join("\n"));
    if (!f.html) abort(`"${f.name}" has no rules text.`);
  }
  return { description: html(rulesText), sections, features };
}

function metadata(key) {
  // Do not copy this identity onto unrelated Items by matching display names.
  return { [SCOPE]: { twContent: { origin: ORIGIN, kitKey: key } } };
}
function record(doc) {
  return doc?.flags?.[SCOPE]?.twContent;
}
function originKey(doc) {
  const value = record(doc);
  return value?.origin === ORIGIN ? value.kitKey : undefined;
}
function contents(collection) {
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (Array.isArray(collection)) return collection;
  if (typeof collection?.values === "function") return Array.from(collection.values());
  return [];
}
function indexDocs(docs) {
  const index = new Map();
  for (const doc of docs) {
    const key = originKey(doc);
    if (!key) continue;
    if (index.has(key)) abort(`more than one source document is marked "${key}". Keep one copy and try again.`);
    index.set(key, doc);
  }
  return index;
}

function advancement(type, id, data = {}) {
  // 16-character Document IDs and keyed advancement storage match the 6.x data model.
  return { _id: `Trapwright${String(id).padStart(6, "0")}`, type, configuration: {}, value: {}, ...data };
}
function advancements(values) {
  return Object.fromEntries(values.map(a => [a._id, a]));
}
function grantEntries(features, featureUuids) {
  const byLevel = new Map();
  for (const f of features) {
    if (!byLevel.has(f.level)) byLevel.set(f.level, []);
    byLevel.get(f.level).push({ uuid: featureUuids[f.key], optional: false });
  }
  return [...byLevel].sort((a, b) => a[0] - b[0]).map(([level, items]) =>
    advancement("ItemGrant", 300 + level, { level, configuration: { items, optional: false, spell: null } }));
}

function trait(id, name, { level = 1, restriction, grants = [], pool = [], count = 0, allowReplacements = false }) {
  return advancement("Trait", id, {
    level, name, ...(restriction ? { classRestriction: restriction } : {}),
    configuration: { mode: "default", allowReplacements, grants, choices: pool.length ? [{ count, pool }] : [] }
  });
}

// Level 3 discipline proficiencies, matching the rulebook text. Replacements let dnd5e offer
// another choice when the character already has the proficiency.
const SUBCLASS_TRAITS = Object.freeze({
  ironwork: () => trait(151, "Hold the Line: Tool Proficiency", {
    level: 3, count: 1, pool: ["tool:art:smith", "tool:art:mason"], allowReplacements: true
  }),
  sigil: () => trait(151, "Seal the Response: Arcana", { level: 3, grants: ["skills:arc"], allowReplacements: true }),
  wildway: () => trait(151, "Bad Ground: Skill Proficiency", {
    level: 3, count: 1, pool: ["skills:nat", "skills:sur"], allowReplacements: true
  }),
  maw: () => trait(151, "Marked as Prey: Skill Proficiency", {
    level: 3, count: 1, pool: ["skills:ste", "skills:dec"], allowReplacements: true
  })
});

function baseClassTraits() {
  return [
    trait(101, "Saving Throw Proficiencies", { restriction: "primary", grants: ["saves:dex", "saves:int"] }),
    trait(102, "Armor Training", { grants: ["armor:lgt"] }),
    trait(103, "Additional Armor Training", { restriction: "primary", grants: ["armor:med", "armor:shl"] }),
    trait(104, "Weapon Proficiencies", {
      restriction: "primary", grants: ["weapon:sim", ...["handcrossbow", "rapier", "scimitar", "shortsword"].map(w => `weapon:mar:${w}`)]
    }),
    trait(105, "Thieves’ Tools Proficiency", { grants: ["tool:thief"] }),
    trait(106, "Artisan’s Tools Proficiency", {
      restriction: "primary", count: 1, pool: ["tinker", "smith", "mason", "woodcarver"].map(t => `tool:art:${t}`)
    }),
    trait(107, "Skill Proficiencies", {
      restriction: "primary", count: 2, pool: ["acr", "arc", "inv", "nat", "prc", "slt", "ste", "sur"].map(s => `skills:${s}`)
    })
  ];
}

function classData(rules, featureUuids) {
  // The class description still includes the ASI and Epic Boon rules. The native prompts
  // handle those levels; do not grant duplicate informational features to actors.
  const classFeatures = rules.sections[ORIGIN].features.filter(f => !["ability-score-improvement", "epic-boon"].includes(f.slug));
  const rulesHTML = rules.description;
  const entries = [
    advancement("HitPoints", 1),
    advancement("Subclass", 2, { level: 3, name: "Trapwright Specialization" }),
    ...baseClassTraits(),
    ...ASI_LEVELS.map(level => advancement("AbilityScoreImprovement", 200 + level, {
      level, configuration: { cap: 2, points: 2, max: 20 }
    })),
    // Same shape as the official 2024 classes: the native prompt offers the Epic Boon feat choice.
    advancement("AbilityScoreImprovement", 219, { level: 19, name: "Epic Boon", configuration: { cap: 2, points: 2 } }),
    ...grantEntries(classFeatures, featureUuids)
  ];
  return {
    identifier: ORIGIN, levels: 1, hd: { denomination: "d8", spent: 0 }, wealth: "125",
    primaryAbility: { value: ["int"], all: true },
    description: { value: rulesHTML }, advancement: advancements(entries)
  };
}

function subclassData(key, rules, featureUuids) {
  const section = rules.sections[key];
  return {
    identifier: key, classIdentifier: ORIGIN,
    description: { value: html([...section.intro, ...section.features.flatMap(f => [
      `### Level ${f.level}: ${f.name}`, ...f.lines
    ])].join("\n")) },
    advancement: advancements([...grantEntries(section.features, featureUuids), SUBCLASS_TRAITS[key]()])
  };
}

function itemData(name, type, key, folder, system) {
  return {
    name, type, folder, img: ART, system: { ...system, source: { custom: "Pacts & Polyhedrals: Trapwright", rules: "2024" } }, flags: metadata(key),
    // Class kit content is intended for players, including resolving its same-world Item Grant UUIDs.
    ownership: { default: 2 }
  };
}

function itemIdentity(doc, d) {
  return doc.type === d.type && (d.type === "feat" || (
    doc.system?.identifier === d.system.identifier &&
    (d.type !== "subclass" || doc.system?.classIdentifier === ORIGIN)
  ));
}

function isClassCollision(doc, key, name) {
  if (originKey(doc)) return false;
  if (key === ORIGIN) return doc.type === "class" && (doc.system?.identifier === ORIGIN || doc.name === name);
  return doc.type === "subclass" && doc.system?.classIdentifier === ORIGIN &&
    (doc.system?.identifier === key || doc.name === name);
}

function assertGM(world) {
  if (!world?.user?.isGM || world.users?.activeGM?.id !== world.user.id) abort("run the installer as the active GM.");
}
function worldItemUuid(doc) {
  return doc.uuid ?? (doc.id ? `Item.${doc.id}` : null);
}

async function runInstall({ rulesText, world, ItemDocument, FolderDocument, load }) {
  assertGM(world);
  // dnd5e 6.0 is the first release built for Foundry v14 and stores advancement keyed by ID.
  if (world.system?.id !== "dnd5e" || !(Number.parseInt(String(world.system?.version ?? ""), 10) >= 6)) {
    abort("this class kit requires the Foundry D&D 5e system, version 6.0 or later.");
  }
  if (typeof FolderDocument?.create !== "function" || typeof ItemDocument?.create !== "function") {
    abort("Foundry's world-document API is unavailable.");
  }
  if (rulesText === undefined) {
    const response = await load(RULES, { credentials: "same-origin", redirect: "error" });
    if (!response?.ok) abort("could not load trapwright/TRAPWRIGHT.md from this module installation.");
    rulesText = await response.text();
  }
  const rules = parseTrapwrightRules(rulesText);
  const docs = contents(world.items);
  const existing = indexDocs(docs);
  const currentFolders = indexDocs(contents(world.folders).filter(f => f.type === "Item"));
  const classSources = [[ORIGIN, "Trapwright"], ...Object.entries(SUBCLASSES)];
  for (const [key, name] of classSources) {
    if (docs.some(doc => isClassCollision(doc, key, name))) {
      abort(`an unmarked world Item already uses the ${name} identity; the installer will not overwrite it.`);
    }
    const doc = existing.get(`source:${key}`);
    const type = key === ORIGIN ? "class" : "subclass";
    if (doc && !itemIdentity(doc, { type, system: { identifier: key } })) {
      abort(`the existing ${name} source has the wrong document type or identifier.`);
    }
  }
  for (const f of rules.features) {
    if (existing.has(f.key) && existing.get(f.key).type !== "feat") abort(`the existing ${f.name} source is not a Feature Item.`);
  }
  const notes = [
    "These are World Items, not a character-builder compendium. Use the native character sheet in this world; install fresh in each destination world.",
    "Drag Trapwright onto a character sheet with advancement enabled. At level 3, drag one of the kit’s subclass Items into the subclass advancement chooser.",
    "Starting equipment, multiclass eligibility (Intelligence and Dexterity 13), subclass tool choices and other conditional or tactical feature effects are handled by the table unless Trap Forge explicitly handles them. This install does not modify existing actors."
  ];
  let created = 0, reused = 0;
  let folder = currentFolders.get("folder");
  assertGM(world);
  if (!folder) {
    folder = await FolderDocument.create({ name: FOLDER_NAME, type: "Item", flags: metadata("folder"), sorting: "a" });
  }
  if (!folder?.id) abort("could not prepare the Trapwright Items folder.");
  const featureUuids = {};
  async function use(data, key) {
    let doc = existing.get(key);
    if (doc) reused++;
    else {
      assertGM(world);
      doc = await ItemDocument.create(data);
      if (!doc || !itemIdentity(doc, data) || originKey(doc) !== key) abort(`Foundry could not create ${data.name} with its required data.`);
      existing.set(key, doc);
      created++;
    }
    const uuid = worldItemUuid(doc);
    if (!uuid?.startsWith("Item.")) abort(`could not get the same-world UUID for ${data.name}.`);
    return { uuid, doc };
  }
  for (const feature of rules.features) {
    const { key, name, level, slug, scope, html: description } = feature;
    const { uuid } = await use(itemData(name, "feat", key, folder.id, {
      identifier: `${scope}-${slug}`, type: { value: "class", subtype: "" },
      prerequisites: { level },
      requirements: `${scope === ORIGIN ? "Trapwright" : SUBCLASSES[scope]} level ${level}`,
      description: { value: description }
    }), key);
    featureUuids[key] = uuid;
  }
  function warnStaleGrants(doc, system) {
    const raw = doc.toObject?.().system?.advancement ?? doc._source?.system?.advancement ?? doc.system?.advancement;
    const current = typeof raw?.values === "function" ? Array.from(raw.values()) : Object.values(raw ?? {});
    const granted = new Set(current.filter(a => a.type === "ItemGrant").flatMap(a => Array.from(a.configuration?.items ?? []).map(item => item.uuid)));
    const expected = Object.values(system.advancement).filter(a => a.type === "ItemGrant").flatMap(a => a.configuration.items.map(item => item.uuid));
    if (expected.some(uuid => !granted.has(uuid))) notes.push(`${doc.name} lacks one or more expected Item Grant links. Restore them in the source Item’s Advancement tab; the installer does not overwrite source edits.`);
  }
  const sourceUuids = {};
  for (const [key, name] of classSources) {
    const type = key === ORIGIN ? "class" : "subclass";
    const system = type === "class" ? classData(rules, featureUuids) : subclassData(key, rules, featureUuids);
    const { uuid, doc } = await use(itemData(name, type, `source:${key}`, folder.id, system), `source:${key}`);
    warnStaleGrants(doc, system);
    sourceUuids[key] = uuid;
  }
  const { trapwright: classUuid, ...subclassUuids } = sourceUuids;
  return { folderUuid: folder.uuid ?? `Folder.${folder.id}`, classUuid, subclassUuids, featureUuids, created, reused, notes };
}

/** Install or resume the original kit in the current world (GM only). Never modify existing documents. */
export function installTrapwrightKit({
  rulesText, world = globalThis.game, ItemDocument = globalThis.CONFIG?.Item?.documentClass ?? globalThis.Item,
  FolderDocument = globalThis.CONFIG?.Folder?.documentClass ?? globalThis.Folder, load = (...args) => fetch(...args)
} = {}) {
  // Only the active GM may install, and repeated UI calls in that client share one installation.
  assertGM(world);
  if (pending) return pending;
  pending = runInstall({ rulesText, world, ItemDocument, FolderDocument, load }).finally(() => { pending = undefined; });
  return pending;
}
