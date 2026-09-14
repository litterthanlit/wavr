# Templates

`npx create-wavr [dir] --template <id> --preset <name>`

| id | Use when |
| --- | --- |
| `hero` | Full-viewport shader, headline, CTA (default) |
| `waitlist` | Email capture over a shader |
| `product` | Hero plus feature cards |
| `html` | Zero-framework `index.html` + IIFE. Fastest Simple Browser preview |

Generated Next apps include:

- `wavr.config.ts` — source of truth
- `components/WavrBackground.tsx` — `WavrGradient` with `editor` in development
- `POST /api/wavr-config` — Apply writes `wavr.config.ts` (disabled in production)
- `.cursor/skills/wavr`, `.claude/skills/wavr`, `.codex/skills/wavr`
