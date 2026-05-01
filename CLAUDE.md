# caffeine-rush — CLAUDE.md

This file is read at the start of every Claude Code session. Follow these instructions for all work on this project.

---

## What This Is

Caffeine Rush is a standalone browser mini-game by Ian Standbridge, lived at **caffeine.ianstandbridge.com** (subdomain), separate from the main personal site at ianstandbridge.com (parallel project `ian-world`, in development).

**Origin story (matters for tone):** Ian and his coworkers got curious how caffeine actually works at the molecular level. They used Claude to build an interactive diagram, then turned the diagram into a game. A friend (Luke McSween) challenged Ian to monetize it. Both Ian and Claude initially said it couldn't really be monetized. This site is the response: a polished, half-serious attempt to monetize it anyway, distributed via a LinkedIn post framed as "help me prove Luke wrong."

**The tone is playful, self-aware, and educational.** The game is fun, the science is real, and the "monetization" is partially a bit. Visitors should leave knowing slightly more about adenosine than they did before, having had a quick laugh, and ideally either tipping a buck or sharing the link.

The game itself is a fast SVG arcade where players click empty receptors to dock caffeine before drifting adenosine binds them. Score accumulates while caffeine is bound. Lose if more than half the receptors are adenosine-blocked for 5 consecutive seconds. Three levels: Morning, Afternoon Slump, Late Night.

---

## Tech Stack

- **Vanilla HTML / CSS / JS** — no framework, no build step, no bundler
- **Single-page static site** — `index.html` is the deliverable
- **Vercel** — deployment target, auto-detected as static site
- **Domain** — `caffeine.ianstandbridge.com` (subdomain CNAME after first deploy)
- **Supabase** — added in Sprint 2 only, for the leaderboard

No Vite. No React. No npm dependencies at runtime in v1.

---

## File Structure

```
caffeine-rush/
├── index.html        # landing wrapper + game + monetization bit + edu section
├── styles.css        # design tokens (:root) + game styles + landing styles
├── game.js           # all game logic (extracted from the original single-file version)
├── public/
│   └── favicon.svg   # caffeine molecule favicon
├── README.md
├── CLAUDE.md         # this file
└── _input/
    └── caffeine_rush_game_v5.html   # original source, reference only, not deployed
```

---

## Design Tokens

The original game was built inside Claude's artifact preview environment, which provided design tokens via CSS variables. Define them in `:root`:

```css
:root {
  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;

  /* Text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-text-success: #2d8659;
  --color-text-warning: #b87333;
  --color-text-danger: #c0392b;
  --color-text-info: #2c5f9e;

  /* Backgrounds */
  --color-background-primary: #ffffff;
  --color-background-secondary: #f5f4f0;
  --color-background-success: #e6f4ec;
  --color-background-warning: #fbf0e1;
  --color-background-danger: #fbe6e3;
  --color-background-info: #e3edf7;

  /* Borders */
  --color-border-primary: #1a1a1a;
  --color-border-secondary: #c4c2bc;
  --color-border-tertiary: #e5e3dd;

  /* Radius */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}
```

Molecule colors hard-coded in the SVG must not change: caffeine `#D85A30` (orange), adenosine `#7F77DD` (purple). These are the visual identity.

---

## Page Layout

```
┌────────────────────────────────────────────┐
│                                            │
│           Caffeine Rush                    │
│           defend the receptors             │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │      [ game playfield ]              │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [ joke ad slot — see "Monetization" ]     │
│                                            │
│  How to play                               │
│   • Click empty receptors to dock caffeine │
│   • Don't let half block out for 5s        │
│   • Drink to refill (8s cooldown)          │
│                                            │
│  How caffeine actually works               │
│   [ 4–6 sentences of real science copy ]   │
│                                            │
│  ☕ Buy me a coffee                         │
│                                            │
│  ← ianstandbridge.com                      │
│                                            │
└────────────────────────────────────────────┘
```

Centered, max-width ~760px, generous vertical padding, soft off-white background matching `--color-background-secondary`.

---

## Monetization (The Bit)

Two elements, both visible on the page:

### 1. Joke ad slot
A real-looking ad banner that's obviously part of the joke. Goes immediately below the game. Style it like a tasteful banner ad (light border, "Ad" or "Sponsored" label in the corner, monospace) but the content is self-deprecating:

```
┌────────────────────────────────────────────┐
│ Ad slot                                    │
│                                            │
│ Your ad could be here. Email ian@example.  │
│ com. Pricing: whatever you'll pay.         │
│ Current sponsors: nobody (Luke is welcome  │
│ to claim this).                            │
└────────────────────────────────────────────┘
```

Use a real email Ian provides (placeholder until he gives you one). The joke is the absurdity of the offer.

### 2. Buy Me a Coffee link
A real, working tip jar. One small button or text link near the bottom of the page, above the back-link footer. Use a placeholder URL until Ian provides his real one:

```html
<a href="https://www.buymeacoffee.com/PLACEHOLDER" class="bmc-link" target="_blank" rel="noopener">
  ☕ buy me a coffee
</a>
```

Keep it understated. The whole monetization layer should read as charming under-effort, not desperate.

**Do not add real third-party ad networks (AdSense, Ezoic, Adsterra) in v1.** They require approval the site won't have, require a privacy policy and cookie consent banner, and break the joke. If Sprint 3+ ever pursues real ads after the post lands, that's a separate decision.

---

## Educational Section: "How caffeine actually works"

This is the LinkedIn-share hook — visitors learn something real, not just play a game. Place it below "How to play." Tone is plain-language, accurate, friendly. No jargon. ~4–6 sentences.

Draft copy (Claude Code can use this verbatim or polish; Ian will edit later):

> While you're awake, your brain produces a molecule called adenosine. It slowly builds up and binds to receptors that signal "you're tired." Caffeine has a shape similar enough to adenosine that it can dock at the same receptors first, blocking adenosine from binding. You don't actually feel more energized — you just feel less tired. Eventually adenosine wins, the caffeine wears off, and you crash. Hence: another cup.

The game's visual elements (purple adenosine, orange caffeine, receptor docks) directly mirror this explanation. That's the connection that makes the page educational rather than just a game with a paragraph stapled on.

---

## Game Mechanics — Do Not Change

These values are tuned and shipped:

- Caffeine mug: 8 max charges, starts at 5
- Drink cooldown: 8 seconds (refills mug to 8)
- Click cooldown: 400ms between receptor clicks
- Caffeine bind duration: 8s / 7s / 6s by level
- Adenosine bind duration: 8s / 7s / 6s by level
- Lose condition: >50% receptors adenosine-blocked for 5 consecutive seconds
- Levels: Morning (4 receptors, 30s), Afternoon Slump (5 receptors, 30s), Late Night (6 receptors, infinite)

If gameplay tuning changes later, edit the `LEVELS` array at the top of `game.js`. Nothing else needs to change.

---

## Deployment

```bash
git init
git add .
git commit -m "Initial caffeine rush deploy"
git branch -M main
git remote add origin git@github.com:USERNAME/caffeine-rush.git
git push -u origin main

# Then on Vercel:
# 1. Add New Project → Import → select repo
# 2. Framework preset: Other (or Static)
# 3. Build command: (none)
# 4. Output directory: (root, leave blank)
# 5. Deploy
# 6. Add custom domain: caffeine.ianstandbridge.com
# 7. At registrar: add CNAME `caffeine` → cname.vercel-dns.com
```

After first deploy, future updates: edit, commit, push. Auto-builds in ~30s.

---

## Sprint Plan

| Sprint | Focus | Done When |
|--------|-------|-----------|
| 1 | Package + landing + monetization bit + edu copy + deploy | Live at caffeine.ianstandbridge.com, joke ad slot visible, BMC link clickable, "How caffeine works" copy renders, no console errors |
| 2 | Supabase leaderboard | Game-over modal asks for name, top-50 board renders live, scores persist across visitors |
| 3 (optional) | Polish + post | Real BMC URL plugged in, post copy finalized, og:image for the LinkedIn preview, post goes live |

Work one sprint at a time. Sprint 2 prompt will be drafted separately after Sprint 1 ships.

---

## Things To Avoid

- Do not rewrite the game logic in a framework
- Do not introduce npm dependencies in Sprint 1
- Do not change molecule colors or core game mechanics
- Do not couple this repo to `ian-world` in any way
- Do not put this game at the apex `ianstandbridge.com` domain — subdomain only
- Do not add real ad networks (AdSense, etc.) in v1 — they will reject and the joke slot is the better fit
- Do not add cookie consent banners, privacy policies, or GDPR scaffolding in v1 (no third-party tracking = none required)
- Do not add multiplayer or real-time gameplay
- Do not over-design the educational copy into a wall of text — 4–6 sentences max

---

## Future Ideas (Not For v1 or v2)

- Daily seed mode — same molecule pattern for everyone that day
- Mobile tap optimizations + touch hit-targets
- "Game Room" embed inside `ian-world` once that ships — arcade cabinet links here
- Sound effects (toggle off by default)
- Real ad network IF the post pops and sustained traffic justifies it
- "Premium skin pack" — different molecule designs for $3 lifetime, on-theme monetization
