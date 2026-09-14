export const TEMPLATES = ["hero", "waitlist", "product", "html"] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export const PRESETS = [
  "aurora",
  "sunset",
  "midnight",
  "candy",
  "ocean",
  "lava",
  "cyber",
  "monochrome",
  "newspaper",
  "stipple",
  "dissolve",
  "morse",
  "retroCrt",
  "broadcastSignal",
  "vhs",
  "neonBars",
  "dataMosh",
  "slitScan",
  "corruption",
  "signalLoss",
  "filmNoir",
  "bladeRunner",
  "tron",
  "vaporwave",
  "northernLights",
  "deepSea",
  "forestCanopy",
  "sandstorm",
  "liquidMetal",
  "oilSlick",
  "prism",
  "smoke",
] as const;
export type PresetId = (typeof PRESETS)[number];

export interface CliOptions {
  dir: string;
  template: TemplateId;
  preset: PresetId;
  link: string | null;
  help: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "wavr-landing",
    template: "hero",
    preset: "aurora",
    link: null,
    help: false,
  };
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--template" || arg === "-t") {
      const value = argv[i + 1];
      i += 1;
      if (!isTemplate(value)) {
        throw new Error(`Unknown template "${value}". Use: ${TEMPLATES.join(", ")}`);
      }
      options.template = value;
      continue;
    }
    if (arg === "--preset" || arg === "-p") {
      const value = argv[i + 1];
      i += 1;
      if (!isPreset(value)) {
        throw new Error(`Unknown preset "${value}".`);
      }
      options.preset = value;
      continue;
    }
    if (arg === "--link") {
      const value = argv[i + 1];
      i += 1;
      if (!value) throw new Error("--link requires a workspace path");
      options.link = value;
      continue;
    }
    if (arg?.startsWith("-")) {
      throw new Error(`Unknown flag ${arg}`);
    }
    if (arg) rest.push(arg);
  }

  const first = rest[0];
  if (first) options.dir = first;
  return options;
}

function isTemplate(value: string | undefined): value is TemplateId {
  return TEMPLATES.includes(value as TemplateId);
}

function isPreset(value: string | undefined): value is PresetId {
  return PRESETS.includes(value as PresetId);
}
