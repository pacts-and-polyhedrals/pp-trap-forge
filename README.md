# Pacts & Polyhedrals: Trap Forge
**0.10.1 • Foundry VTT 14 • No system or animation-module dependency**

By Asmo, Pacts & Polyhedrals (Ben Vale) · [Patreon](https://www.patreon.com/pactsandpolyhedrals)

A GM tool for turning hidden tiles into fantasy traps. It builds on Ben Vale’s Trap Forge and Pro Tile Picker macros, but registers its hooks as a normal module. You do not run a macro every session.

## Install

**Manifest URL (Foundry or The Forge):**

```
https://github.com/pacts-and-polyhedrals/pp-trap-forge/releases/latest/download/module.json
```

In Foundry, go to **Add-on Modules → Install Module**, paste the URL above into **Manifest URL** and click **Install**. On The Forge, use **Bazaar → Install a custom package** with the same URL. Then enable **Pacts & Polyhedrals: Trap Forge** in **Game Settings → Manage Modules**.

**Manual install:** Download `pp-trap-forge.zip` from the [latest release](https://github.com/pacts-and-polyhedrals/pp-trap-forge/releases/latest) and unzip it into `Data/modules/pp-trap-forge/`, so that `module.json` sits directly inside that folder.

Try it in a test world before your first session.

## Place and trigger

1. As GM, open a scene. In the **Tiles** scene controls, click the skull-and-crossbones **Trap Forge** tool.
2. Choose **Place trap**, search the preset catalog, or choose **Blank/custom trap**. Configure the dice, save, DC, effect text and reset behaviour.
3. The tile appears at the selected token, or at the viewport centre. Drag it where you want it. The default marker is included. You can point at a custom image or video already stored in Foundry Data. Use a relative Foundry Data path, not a JB2A animation database key. The **Browse** button opens Foundry’s file picker where supported.
4. Move an owned player token across the tile. For the default setup, the tile is hidden until the first entry. Foundry then reveals the map artwork, plays the animation and sound cue, posts the full damage roll and prompts the target in chat. A selected token placed directly on a new trap has to leave and re-enter to count as a new entry.
5. The target's owner can roll from the chat card, or the active GM can record a save rolled normally on the character sheet. Trap Forge posts the final damage amount and any failure instruction in chat. HP, resistance, immunity, conditions, teleportation and other state changes are adjudicated by the GM rather than silently modifying actors.
6. Use **Manage traps** to edit, disarm, rearm/re-hide or privately test one with a selected token. A private test does not reveal or consume the trap. One active GM must be connected for automatic processing and chat resolution.

## Animated artwork and sound

- All 86 built-in presets have a matching cue out of the box. There are **28 selectable effect profiles**, **21 original tile textures**, and **27 original sounds**. No Sequencer, animation pack, or premium art is required.
- **Glyph of Flame** has a radial fireball burst; **Wall Flame Jet** comes from one side and sweeps across the tile. Place that tile next to a wall. With a normal tile rotation, **cue angle 0°** means fire enters from the left edge, **90°** from the top, **180°** from the right, and **270°** from the bottom. Changing the tile's own rotation rotates the cue too. **Pressure Plate Pit** opens on the map and leaves a visible dark pit after the short animation. Other families include lightning arcs, swirling runes, gas, dart volleys, frost, stone collapse, blades, and mimic jaws.
- **Auto by trap** chooses by name and damage type. For a custom trap, change the effect profile directly. The GM can change the cue angle and sound volume, override the permanent tile texture or sound, and toggle animation and sound independently. **No reveal art or cue** keeps the original marker/custom texture but does not disable the dice flow.
- Clients can set **Trap Forge: sound volume** to zero or disable moving effects in Module Settings. Reduced-motion clients get a gentle pulse instead of full movement. The effects display only on the active scene and floor and respect client token vision. The private **Test selected token** button plays only for the active GM and does not use up or reveal the placed tile. For normal sound, the player must have unlocked Foundry audio by interacting with the game.
- If you imported v0.9.0 earlier, update the same module ID (no duplicate folder). The module supplies audiovisual defaults at read time for existing tiles. Rearm a previously spent trap to see its new reveal.

## Optional player class: The Trapwright (2024 D&D)

The Trapwright has full level 1–20 rules and four disciplines. An exclusive 22/22/21/21 split covers all 86 GM presets, with tier unlocks at Trapwright levels 3, 5, 11 and 17 and two common practice designs. Portable traps reuse the preset artwork and sounds, but get a bounded one-target effect, limited charges and a class saving throw DC. The ordinary GM trap catalog is not replaced or weakened. Read `trapwright/TRAPWRIGHT.md` for the full rules.

1. In a **Foundry v14** world with **D&D 5e system 6.0 or later**, open **Tiles → Trap Forge → Trapwright class kit → Install class into Items** as active GM. This creates 38 original World Items and native same-world advancement links. It does not modify an actor.
2. Open a new 2024 D&D character using the native sheet. Drag the **Trapwright** class from the **Trapwright Class Kit** Items folder and progress normally. At level 3, drop the discipline item into the native subclass advancement; the discipline's tool or skill proficiency is then offered as a native choice. Starting equipment, several tabletop benefits and special rider effects are described on their Items, not all automated.
3. Place and select the character's **linked** Friendly token. Open the same GM menu and choose **Enable deployment**. Do this only for characters who should have access. The world-owned charge ledger can be reset for a long rest or adjusted individually by the GM.
4. As the player, select your token and choose **Deploy Trap** in the character sheet header menu or Token controls. Pick an unlocked schematic and an adjacent side. It sends a private request; the active GM client verifies character ownership, subclass, charge, space and limits, then creates the hidden tile on the player's behalf. No general tile permission is granted. This flow supports standard 5-foot square and gridless scenes. Use manual GM placement for other grid scales and hexes.
5. Move an opposing token across the tile. The module posts the damage/save as usual. Friendly/neutral tokens don't trigger it automatically; the GM decides unusual allegiance, involuntary movement from modules that do not label it, and subclass riders. The tool recognizes already-spent traps, caps active traps at proficiency bonus, and expires portable traps after one hour of Foundry world time. It does not spend combat actions or apply HP or conditions.

The D&D class installer is optional; non-D&D systems retain the existing GM module. This test build installs **World Items**, not a Character Forge compendium. Native advancement is the supported first test; Character Forge compatibility has not been live-checked. Reinstalling checks existing kit items without overwriting user edits. If you installed the kit with 0.10.0, delete the **Trapwright Class Kit** folder and its Items (before any character uses them) and reinstall to pick up the 0.10.1 discipline proficiencies.

### Systems and movement
- **D&D 5e:** The button calls the actor’s native saving-throw method when present.
- **Pathfinder 2e:** The button supports the available native Fortitude, Reflex and Will checks. D&D preset save names map to a PF2e equivalent. Set the DC and dice for your table. Uses four degrees as a convenience: critical success no damage, critical failure double, ordinary success as configured. This is a basic-save-style default, not a complete PF2e hazard stat block or a substitute for situational outcome changes.
- **Any other system:** Choose a custom save label and DC. The button offers editable dice and a modifier, or have the player roll on their normal sheet and record the result as GM. The generic result uses total vs DC; GM may directly record success or failure.
- V14 movement is processed using the token centre along the completed path, not remaining ruler waypoints. A token can cross entirely over a tile in one move. Starting inside and moving out is not a new entry. Rotated tile bounds, optional elevation limits and a tile set to one scene level are accounted for. Teleport segments do not sweep between points; landing inside can trigger.
- Choose player-owned tokens or all visible actor tokens. One-shot, repeat-on-entry and seconds-based cooldown modes are available. Direct API updates that do not emit Foundry's moveToken hook are not covered. Trap orders fire after Foundry accepts movement; the module does not interrupt already completed movement.

### Presets and old tiles
86 editable, original fantasy presets cover mechanical, magical, environmental, living/mimic, and complex/puzzle traps. These are game rules and descriptions, not copies from proprietary books. Presets such as Needle Lock and Door With Teeth use a tile crossing in this build; they do not hook door or item interactions. For multi-stage hazards use separate tiles and adjudicate the rest with the included effect notes.

**Adopt old tiles** recognises earlier Trap Forge tile flags when present, preserving tile art, location and old flags. Stop running the old script and reload clients first so old hooks cannot fire alongside the module. Make a copy of your scene before migration.

## Test status and known gaps

The JavaScript and 39 automated checks pass, and the class kit's item data was checked against the dnd5e 6.1.1 data models and the official 2024 class compendium. The test harness simulates movement, reveal, save resolution and audiovisual dispatch, including distinct PF2e and D&D 5e save calls. All 28 effects were rendered in Skia at five time points, all 21 SVGs rendered, and all 27 shipped Oggs decoded with no clipping. These checks exercise the actual painter and module logic, not a licensed Foundry client. **This candidate has not been loaded in a licensed Foundry v14 world or against a live D&D 5e/PF2e actor.** Rendered dialog integration, actual platform movement, chat UX and native save behavior need that final smoke test. No gameplay data has been changed.

Suggested live acceptance: install the Trapwright kit and test deployment with a real non-GM player before using it in a session. Separately, mirror the same test scene in a v14 scratch world with GM and player clients. Start with **Wall Flame Jet** and **Pressure Plate Pit**. From a player client, cross each tile and verify the map reveal, sound and exactly one save card. Click the save button and confirm exactly one damage outcome. Rearm a tile and repeat if needed. Try a translated save in PF2e and the generic dice/GM override in a non-D&D test world. Test an ordinary video texture from Foundry Data separately if you use one.

Run the local automated checks using Node.js 22 or later with `node --test test/*.test.mjs` from the module folder.

API references: [v14 moveToken](https://foundryvtt.com/api/v14/functions/hookEvents.moveToken.html), [v14 scene controls](https://foundryvtt.com/api/v14/functions/hookEvents.getSceneControlButtons.html), [v14 chat render](https://foundryvtt.com/api/v14/functions/hookEvents.renderChatMessageHTML.html).
