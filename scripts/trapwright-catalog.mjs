import {CATALOG} from "./catalog.mjs";

/** Persistent identifiers for the four Trapwright subclass specializations. */
export const TRAPWRIGHT_SPECIALIZATIONS = Object.freeze({
  ironwork: "Ironwork Engineer",
  sigil: "Sigil Binder",
  wildway: "Wildway Warden",
  maw: "Mawkeeper"
});

const UNLOCK_LEVELS = Object.freeze([3, 5, 11, 17]);

/**
 * Each GM preset has one specialization only. Tier gates are Trapwright class
 * levels, not total character level. These are access rules, not damage or effect
 * rules; player-deployed traps must use the class's separately bounded profiles.
 * Thematic overlaps: flame jets are ducted machinery, the Curse Mirror is a
 * deceptive lure, and tilted rooms and sandstone slides are terrain hazards.
 */
const GROUPS = {
  ironwork: {
    3: ["Hidden Dart Gallery", "Net Drop", "Shatterglass Step", "Trip Chime", "Iron Jaw"],
    5: ["Pressure Plate Pit", "Sinking Stair", "Spear Gallery", "Wall Flame Jet", "Spring Cage"],
    11: ["Spiked False Floor", "Scythe Passage", "Falling Portcullis", "Counterweight Hammer", "Pendulum Corridor", "Clockwork Gauntlet"],
    17: ["Rolling Stone Sphere", "Crushing Walls", "Collapsing Ceiling", "Clockwork Blade Floor", "Four-Bell Lockdown", "Severed Bridge"]
  },
  sigil: {
    3: ["Arcane Alarm", "Binding Sigil", "Rune of Dread", "Echoing Maze Tile", "Fascination Sigil"],
    5: ["Freezing Rune", "Thunder Seal", "Sleep Spiral", "Symbol Sequence Error", "Silence Ward"],
    11: ["Glyph of Flame", "Force Ward", "Radiant Verdict", "Memory-Eating Rune", "Anti-Healing Sigil", "Teleport Snare"],
    17: ["Lightning Lattice", "Shadow-Siphon Tile", "Gravity Inversion Seal", "Summoning Circle", "Hourglass Stutter", "Unstable Portal"]
  },
  wildway: {
    3: ["Quicksand Shelf", "Razorvine Patch", "Ash Cloud", "Undertow", "Sandstone Slide"],
    5: ["Acid Splash Basin", "Steam Grate", "Freezing Mist", "Spore Bloom", "Scree Slide", "Rising Chamber"],
    11: ["Poison Gas Chamber", "Ice Shelf Break", "Falling Icicles", "Sinkhole", "Sonic Geode"],
    17: ["Lava Vent", "Flood Gate", "Storm Conduit", "Drowning Hourglass", "Weighing Room"]
  },
  maw: {
    3: ["Whispering Web", "Sticky Carpet", "Moss That Bites", "Rope Snare", "Illusory Drop", "Needle Lock"],
    5: ["Grasping Roots", "Window That Watches", "Door With Teeth", "False Lever", "Hollow Statue", "Two-Floor Ambush Cue"],
    11: ["Hungry Floor", "Chest That Dreams", "Bookcase Maw", "Curse Mirror", "Coffin Lid"],
    17: ["False Staircase Mimic", "Living Hallway", "Feast-Lock", "False Treasure Pedestal"]
  }
};

const entries = Object.entries(GROUPS).flatMap(([subclass, rows]) =>
  UNLOCK_LEVELS.flatMap(minLevel => rows[minLevel].map(name => [name, Object.freeze({subclass, minLevel})]))
);

export const TRAPWRIGHT_ASSIGNMENTS = Object.freeze(
  Object.assign(Object.create(null), Object.fromEntries(entries))
);

const CATALOG_BY_NAME = new Map(CATALOG.map(preset => [preset.name, Object.freeze({...preset})]));

/** Exact catalog name, not a caller-supplied object or a broad category. */
export function getTrapwrightAssignment(name) {
  if (typeof name !== "string" || !Object.hasOwn(TRAPWRIGHT_ASSIGNMENTS, name)) return undefined;
  return TRAPWRIGHT_ASSIGNMENTS[name];
}

function legalLevel(level) {
  return Number.isInteger(level) && level >= 3 && level <= 20;
}

export function canUseTrapwrightPreset(subclass, level, name) {
  if (typeof subclass !== "string" || !Object.hasOwn(TRAPWRIGHT_SPECIALIZATIONS, subclass) || !legalLevel(level)) return false;
  const match = getTrapwrightAssignment(name);
  return Boolean(match && CATALOG_BY_NAME.has(name) && match.subclass === subclass && match.minLevel <= level);
}

/** The available preset data, in order of unlock tier then authoring order. */
export function getTrapwrightPresets(subclass, level) {
  if (typeof subclass !== "string" || !Object.hasOwn(TRAPWRIGHT_SPECIALIZATIONS, subclass) || !legalLevel(level)) return [];
  return UNLOCK_LEVELS.filter(minLevel => minLevel <= level).flatMap(minLevel =>
    GROUPS[subclass][minLevel].map(name => CATALOG_BY_NAME.get(name)).filter(Boolean)
  );
}
