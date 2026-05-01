# Caffeine Rush

A small browser arcade where you click empty receptors to dock caffeine before drifting adenosine binds them. Score accumulates while caffeine is held. Lose if more than half the receptors are adenosine-blocked for 5 consecutive seconds.

Live at **caffeine.ianstandbridge.com** (after first deploy).

## Origin

Some coworkers got curious about how caffeine actually works at the molecular level. We built an interactive diagram with Claude, then turned the diagram into a game. A friend (Luke McSween) bet it couldn't be monetized. This site is the response — a polished, half-serious attempt to monetize it anyway.

## Stack

Vanilla HTML / CSS / JS. No framework, no build step, no npm. Vercel for static hosting. Supabase added in Sprint 2 for the leaderboard.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

- `index.html` — landing wrapper, game container, joke ad slot, educational copy, BMC link, footer
- `styles.css` — `:root` design tokens + game styles + landing styles
- `game.js` — game logic (IIFE), extracted verbatim from the original single-file artifact
- `public/favicon.svg` — caffeine-molecule favicon
- `_input/` — original single-file source kept as reference (not deployed)
- `CLAUDE.md` — project rules and constraints for Claude Code sessions

## Attribution

Game and site by Ian Standbridge. Built with Claude.
