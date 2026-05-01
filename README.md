# Caffeine Rush

Click empty adenosine receptors to dock caffeine before drifting adenosine binds them. Score accumulates while caffeine is held. You lose if more than half the receptors are adenosine-blocked for 5 consecutive seconds.

**Play:** https://caffeine.ianstandbridge.com

## Origin

Some coworkers got curious how caffeine actually works at the molecular level. We built an interactive diagram with Claude, then turned the diagram into a game. A friend (Luke McSween) bet it couldn't be monetized — this site is the (half-serious) response.

## Stack

Vanilla HTML / CSS / JS. No framework, no build step, no npm. Vercel for static hosting.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

- `index.html` — landing wrapper, game, joke ad slot, "How caffeine actually works", BMC link
- `styles.css` — `:root` design tokens + game styles + landing styles
- `game.js` — game logic (IIFE), extracted verbatim from the original single-file artifact
- `favicon.svg` — caffeine-molecule favicon
- `_input/` — original single-file source kept as reference (not used at runtime)
- `CLAUDE.md` — notes for contributors using Claude Code

## Tip jar

If the game made you smile: <https://www.buymeacoffee.com/ianstandbridge>

## License

[MIT](./LICENSE)
