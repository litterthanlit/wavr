import { parseArgs, TEMPLATES } from "./args";
import { scaffold } from "./scaffold";

const HELP = `create-wavr — scaffold a Wavr shader landing page

Usage:
  npx create-wavr [dir] [--template hero|waitlist|product|html] [--preset aurora]

Options:
  -t, --template   ${TEMPLATES.join(" | ")} (default: hero)
  -p, --preset     Named Wavr preset (default: aurora)
      --link       Absolute Wavr monorepo root; uses pnpm link: to local packages
  -h, --help       Show this message

The generated Next app includes a compact editor overlay in \`next dev\`.
Press E in the preview to toggle it. Apply writes wavr.config.ts.
`;

export function run(argv = process.argv.slice(2)): void {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const dest = scaffold(options);
  process.stdout.write(`Created Wavr landing in ${dest}\n`);
  if (options.template === "html") {
    process.stdout.write("Open index.html with a local static server, or: npx serve .\n");
    return;
  }
  process.stdout.write("Next:\n  cd " + dest + "\n  pnpm install\n  pnpm dev\n");
}

run();
