# CLAUDE.md

Notes for Claude Code (or any contributor) working on this repo.

---

## What this is

A small browser arcade where you click empty receptors to dock caffeine before drifting adenosine binds them. Single-page static site. Lives at **caffeine.ianstandbridge.com**.

## Stack

Vanilla HTML / CSS / JS. **No framework, no build step, no npm.** Static-served. Vercel for hosting.

## File map

```
caffeine-rush/
├── index.html        landing wrapper + game container + monetization + edu copy
├── styles.css        :root design tokens + game styles + landing styles
├── game.js           game logic (IIFE, no globals beyond cgDrink/cgReset)
├── public/
│   └── favicon.svg
├── _input/
│   └── caffeine_rush_game_v5.html   original single-file source, reference only
├── README.md
└── CLAUDE.md
```

## Design tokens

The original game was built inside Claude's artifact preview environment, which supplied design tokens via CSS variables. They're now defined locally in `styles.css` under `:root`. If you add new UI, reuse those tokens — don't introduce new color hex codes outside the molecule colors below.

## Hard-locked visuals

- Caffeine molecule color: `#D85A30` (orange)
- Adenosine molecule color: `#7F77DD` (purple)
- Eye/mouth detail color: `#4A1B0C` / `#26215C`

These are the visual identity. Don't change them.

## Game mechanics

Tuning lives in the `LEVELS` array at the top of `game.js`:

- Level 1 "Morning": 4 receptors, 30s, slow spawns, 8s bind durations
- Level 2 "Afternoon slump": 5 receptors, 30s, faster spawns, 7s bind durations
- Level 3 "Late night": 6 receptors, infinite, fastest spawns, 6s bind durations

Other constants:
- Caffeine mug: 8 max, starts at 5
- Drink cooldown: 8s
- Click cooldown: 400ms
- Lose: >50% receptors adenosine-blocked for 5 consecutive seconds

If you retune, edit `LEVELS` (and `state.alertnessFailMs` for the lose timer). Nothing else needs to change.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Push to `main`. Vercel auto-deploys (no build command, no output dir).

## Don'ts

- Don't migrate to a framework
- Don't add npm dependencies
- Don't introduce a build step
- Don't change the molecule colors
- Don't put this game at the apex `ianstandbridge.com` — subdomain only
