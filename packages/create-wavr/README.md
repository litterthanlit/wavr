# create-wavr

Scaffold a Wavr shader landing page with a compact editor overlay in the preview.

```bash
npx create-wavr my-site
npx create-wavr my-site --template waitlist --preset ocean
npx create-wavr my-site --template html
```

Then:

```bash
cd my-site
pnpm install
pnpm dev
```

The overlay is on during `next dev`. Press **E** to toggle. **Apply to project** writes `wavr.config.ts`.
