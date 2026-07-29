# CP0-C-C1 Asset Manifest

## New C1 asset

| Runtime file | Source evidence | Size | Purpose | Source | Modular | Edge / alpha check |
| --- | --- | ---: | --- | --- | --- | --- |
| `assets/resources/game/art/dishes/dish_warm_hotpot_mix.png` | `reports/cp0-c/c1/assets/source/dish_warm_hotpot_mix_chroma.png`, `dish_warm_hotpot_mix_alpha.png` | 400×400 RGBA; sources 1254×1254 | `RCP_WARM_HOTPOT_MIX` ordinary reveal dish | OpenAI imagegen, generated for this repository | Yes: independent reveal dish sprite | PASS: chroma removed with soft matte/despill; transparent perimeter inspected; no green garnish, scallion, mushroom, carrot, potato, meat or noodles |

Imagegen prompt:

> Create one isolated finished-dish game asset matching the supplied G1-B jelly toy kitchen reference: a shallow cream bowl with mint rim, neutral warm golden broth, glossy tomato wedges and soft scrambled egg pieces only. Centered three-quarter top view, rounded toy-like volumes, appetizing soft highlights, clean silhouette, transparent-ready. Flat #ff00ff chroma background. Absolutely no scallion, chive, herb, green garnish, mushroom, carrot, potato, meat, noodles, pepper, sesame, plate decoration, text, UI, shadow outside the asset, or extra ingredient.

The 1254×1254 chroma source is retained as generation evidence. The alpha source records the automated chroma-key result. The 400×400 runtime asset is the Cocos-imported version.

## Reused CP0-A baseline assets

No existing CP0-A art file was modified. C1 reuses these modular runtime sprites:

- Background: `assets/resources/game/art/background/kitchen_bg_base.png`
- Board ingredients: `ingredient_tomato.png`, `ingredient_egg.png`, `ingredient_potato.png`, `ingredient_carrot.png`, `ingredient_mushroom.png`
- Target dish: `assets/resources/game/art/dishes/dish_tomato_egg.png`
- Pot modules: `research_pot.png`, `research_pot_front.png`, `pot_lid.png`, `pot_tomato.png`, `pot_egg.png`
- Battle UI: `board_frame.png`, `tile_normal.png`, `pause_button.png`, `step_badge.png`, `order_tray.png`, `throw_tray.png`, `fire_button.png`
- Reveal UI: `reveal_halo.png`, `reveal_pedestal.png`, `reveal_nameplate.png`, `rarity_normal.png`, `star_on.png`, `star_off.png`, `book_button.png`, `continue_button.png`

All reused files remain independently addressable Cocos resources; no concept sheet, web component, Emoji, placeholder block, or flattened full-screen image is used.
