# Caffeine Rush — Sprint 1 Kickoff (Claude Code Prompt)

## Context

This repo deploys to **caffeine.ianstandbridge.com** as a standalone subdomain site. Read `CLAUDE.md` first — it has the full architecture, the design token palette, the page layout, the monetization bit (joke ad slot + Buy Me a Coffee tip jar), and the educational science section.

The source-of-truth game file is `caffeine_rush_game_v5.html` in repo root (or `_input/`). It's a complete working ~470-line single-file SVG game built originally inside Claude's artifact preview environment. The job is to package it as a deployable static site with the surrounding wrapper, not to redesign or rebuild it.

---

## Prompt to paste into Claude Code

```
We're packaging an existing single-file SVG game into a deployable static site, plus adding a small landing wrapper, a joke "ad slot" (part of a LinkedIn-distributed bit about monetization), a real Buy Me a Coffee link, and a short educational section about how caffeine actually works.

Read CLAUDE.md FIRST. It has the full spec, the design token palette to define, the page layout, the joke-ad-slot copy, the educational section copy, and explicit constraints. Do not skip it.

The input file is `caffeine_rush_game_v5.html` (in repo root or `_input/`). Move it to `_input/` if it's still in root. It uses CSS variables that come from Claude's artifact preview environment and won't render correctly outside it — the main work is defining those variables in :root and packaging cleanly.

Your tasks for Sprint 1, in this order:

1. **Move the input file out of root:**
   - Create `_input/` directory
   - Move `caffeine_rush_game_v5.html` into `_input/` so it's preserved as reference but not deployed

2. **Create three files:**
   - `index.html` — full landing wrapper with title, tagline, game container, joke ad slot, "How to play", "How caffeine actually works", BMC link, and back-link footer
   - `styles.css` — :root design tokens (use the palette from CLAUDE.md exactly), then the game's existing styles, then landing/wrapper styles, then monetization-section styles
   - `game.js` — the IIFE game logic, extracted verbatim from the original `<script>` block. Do not modify any game logic, mechanics, level config, timing values, or SVG-drawing functions.

3. **Extract content from the original HTML:**
   - The `<style>` block goes into `styles.css` AFTER the :root design tokens block
   - The game container HTML (everything inside `<div class="cgame">...</div>` plus the `<h2 class="sr-only">` heading) goes into `index.html` inside the layout wrapper
   - The `<script>` block contents (the IIFE) goes into `game.js`, loaded via `<script src="/game.js" defer></script>` at the end of body

4. **Build the full landing wrapper in `index.html`:**
   - Doctype html, lang="en", utf-8, viewport meta, title "Caffeine Rush"
   - Meta description: "A fast SVG arcade game where you defend adenosine receptors. Click to dock caffeine before sleep wins. Plus: how caffeine actually works."
   - Open Graph tags: og:title, og:description, og:type=website, og:url=https://caffeine.ianstandbridge.com
   - Twitter card tags (summary_large_image; we'll add the actual image in a later sprint)
   - Favicon link to `/favicon.svg`
   - A `<main class="page">` wrapper containing, in order:
     a. `<header class="page-header">` with `<h1>Caffeine Rush</h1>` and `<p class="tagline">defend the receptors</p>`
     b. The existing game container (unchanged structure)
     c. **The joke ad slot** — see below
     d. `<section class="how-to">` with `<h2>How to play</h2>` and a 3-bullet list:
        - Click empty receptors to dock caffeine before adenosine binds
        - Don't let more than half the receptors block out for 5 seconds
        - Drink to refill the mug (8 second cooldown)
     e. `<section class="how-it-works">` with `<h2>How caffeine actually works</h2>` and the educational paragraph from CLAUDE.md (the 4–6 sentence "While you're awake..." copy). Use that copy verbatim or polish only minor wording — do not expand it into multiple paragraphs.
     f. **The Buy Me a Coffee link** — see below
     g. `<footer class="page-footer">` with a single anchor: `← ianstandbridge.com` linking to https://ianstandbridge.com (no target=_blank, same-tab is fine, it's the user's own site)

5. **Build the joke ad slot:**
   - Place immediately below the game container
   - Visually styled like a tasteful banner ad: light dashed or solid border, "Ad slot" or "Sponsored" label in the top-left corner (small caps or monospace), padding, neutral background
   - Width matches the game container
   - Inner content (use this copy):
     ```
     Ad slot

     Your ad could be here. Email ian@ianstandbridge.com.
     Pricing: whatever you'll pay.
     Current sponsors: nobody (Luke is welcome to claim this).
     ```
   - The whole element should read as obviously self-deprecating, not actually trying to sell ad space. The dryness IS the joke. Don't add emoji clutter, don't make it loud.

6. **Build the Buy Me a Coffee link:**
   - Place between the "How caffeine actually works" section and the footer
   - Single anchor tag, simple text + ☕ emoji: `☕ buy me a coffee`
   - URL: `https://www.buymeacoffee.com/PLACEHOLDER` (Ian will replace before posting on LinkedIn)
   - target="_blank" rel="noopener"
   - Style understated — small/medium text, subtle border or just an underline, centered. Should feel offhand, not like a CTA.

7. **Create `public/favicon.svg`:**
   - 32×32 SVG using the same caffeine molecule drawing as in the game: orange #D85A30 circle with two dark eyes (#4A1B0C) and a small smile path. Self-contained, no external refs.

8. **Wrapper styles in `styles.css`:**
   - `body` background: var(--color-background-secondary), generous vertical padding
   - `.page` container: max-width 760px, margin auto, padding for breathing room
   - `.page-header h1`: serif or system sans, 32-40px, weight 500, no decoration
   - `.tagline`: 14-16px, var(--color-text-secondary), no quotes around it
   - `.how-to`, `.how-it-works`: spacing, h2 at ~18px weight 500, body text at 14-15px line-height ~1.5
   - `.ad-slot`: dashed 1px border in var(--color-border-tertiary), padding 16-20px, "Ad slot" label small + uppercase + tracked, monospace optional, neutral background slightly distinct from page bg
   - `.bmc-link`: centered, small, subtle hover state
   - `.page-footer`: small, var(--color-text-secondary), top margin

9. **Verify locally:**
   - Run `python3 -m http.server` from repo root, open http://localhost:8000
   - Confirm:
     - All sections render in the right order (title → game → ad slot → how to play → how caffeine works → BMC → back link)
     - Game colors are correct (purple adenosine, orange caffeine, no missing-variable artifacts)
     - All gameplay works: clicking receptors fires caffeine, drink button cooldowns, level progression, game-over overlay shows on loss, "Play again" resets cleanly
     - Joke ad slot reads as the joke, not actually trying to sell ad space
     - BMC link opens in new tab to the placeholder URL (will 404, that's expected — Ian will swap the URL)
     - Back-link points to https://ianstandbridge.com
     - No console errors
     - Page is reasonably responsive (game scales, text wraps; full mobile polish is Sprint 7-equivalent later)

10. **Add deployment scaffolding:**
    - `README.md` — short description, "Live at caffeine.ianstandbridge.com", origin story (Luke + Claude bit), how to run locally, attribution
    - `.gitignore` — standard (`.DS_Store`, `node_modules/`, `.vscode/`, `*.log`, `_input/.DS_Store`)
    - No `vercel.json` needed — Vercel auto-detects static sites here.

11. **Initialize git:**
    - `git init`
    - `git add .`
    - `git commit -m "Initial caffeine rush package — game + landing + monetization bit"`
    - Stop. Do not push. The user will create the GitHub repo and push manually.

DO NOT in this sprint:
- Modify game mechanics, level timings, mug capacity, cooldowns, or scoring
- Add Vite, npm, React, Tailwind, or any framework
- Add a leaderboard, auth, Supabase, or any backend (that's Sprint 2)
- Add real ad networks (AdSense, Ezoic, etc.) — the joke slot is intentional
- Add cookie consent banners or privacy policies
- Add analytics or tracking scripts
- Change the molecule colors (#D85A30 caffeine, #7F77DD adenosine)
- Expand the educational section beyond ~6 sentences
- Make the joke ad slot loud, gimmicky, or emoji-heavy — dry and tasteful is the joke
- Touch the original `caffeine_rush_game_v5.html` other than moving it into `_input/`

When complete, confirm: "Sprint 1 complete — caffeine rush packaged with landing wrapper, joke ad slot, BMC tip jar, and educational copy. Ready to push to GitHub and deploy to Vercel." Then list the files created and stop.
```

---

## After Claude Code finishes Sprint 1

1. **Open the page locally one last time** at http://localhost:8000 and read the joke ad slot + BMC + educational copy. Tweak any wording you want before committing again.

2. **Replace the placeholders:**
   - The email address in the joke ad slot (currently `ian@ianstandbridge.com` — confirm or change)
   - The Buy Me a Coffee URL (currently `PLACEHOLDER`). If you don't have a BMC account yet, set one up at buymeacoffee.com first — takes 3 minutes, then replace `PLACEHOLDER` with your handle.

3. **Create the GitHub repo** (e.g. `caffeine-rush`, public is fine and actually better for the LinkedIn moment — people can poke around the code).

4. **Push it:**
   ```bash
   git remote add origin git@github.com:YOUR_USERNAME/caffeine-rush.git
   git push -u origin main
   ```

5. **Vercel:** New Project → Import → pick `caffeine-rush` → no build command, no output directory override → Deploy.

6. **Custom domain:** Project Settings → Domains → add `caffeine.ianstandbridge.com`.

7. **DNS:** at your registrar, add a CNAME: `caffeine` → `cname.vercel-dns.com`.

8. **Wait ~5 minutes** for DNS + SSL, then visit `https://caffeine.ianstandbridge.com` in incognito. Verify everything looks right end-to-end.

That's Sprint 1 done. The game is live, the bit is set up, the educational copy is there. Don't post yet — Sprint 2 (leaderboard) makes the LinkedIn post way better. Come back to Claude for the Sprint 2 prompt.
