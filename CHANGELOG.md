# Changes

## 0.10.1 • Release packaging and dnd5e fit
- Added a public GitHub manifest, download, readme, changelog and issue links so Foundry and The Forge can install and update by manifest URL.
- Dropped the hard v14 maximum; the module stays system-agnostic and declares Foundry v14 as minimum and verified.
- Trapwright kit: the installer now accepts dnd5e 6.0 or later instead of only 6.x.
- Trapwright kit: each discipline grants its level 3 proficiency through a native Trait advancement (Smith's or Mason's Tools, Arcana, Nature or Survival, Stealth or Deception), with replacements when already proficient.
- Trapwright kit: Epic Boon now uses the same advancement shape as the official 2024 classes, and the class offers the 125 GP starting-wealth option.
- Class kit data checked field by field against the dnd5e 6.1.1 data models and the 2024 class compendium.
- Release zip has the module files at its root.

## 0.10.0 • Trapwright class playtest
- Added a full 2024 D&D class and four disciplines with all 86 original Trap Forge presets assigned once.
- Added a GM-installed dnd5e v6 class/item kit and scoped player deployment via the sheet or token controls.
- Added portable trap scaling, charge ledger, hostile-only default, class-level gates, one-trigger movement guard and GM adjustments.
- Still requires a live Foundry player/GM smoke test; original GM placement remains system-agnostic.

## 0.9.1 • Audiovisual live-test candidate
- Added 28 original audiovisual profiles and 21 reveal textures with 27 embedded sound cues.
- Added persistent pit artwork, directional wall flames and independently adjustable media controls.
- Added active-scene/level and line-of-sight cue gating, client volume and reduced-motion support.
- Added file pickers for optional custom tile art and sounds; all default content stays offline.
- Extended tests for permanent reveals, custom media, player ownership, scene gating, pan/zoom and native save adapters.

## 0.9.0 • First private test candidate
- Persistent v14 module replacing the session-local Trap Forge macro, 85 editable presets, tile crossings and chat resolution.
