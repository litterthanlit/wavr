import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "disabled in production" }, { status: 403 });
  }

  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || !("config" in body)) {
    return NextResponse.json({ ok: false, error: "invalid config" }, { status: 400 });
  }

  const config = (body as { config: unknown }).config;
  const file = path.join(process.cwd(), "wavr.config.ts");
  const source = `import type { GradientConfig } from "@wavr/gradient";\n\nexport const wavrConfig: GradientConfig = ${JSON.stringify(config, null, 2)} satisfies GradientConfig;\n`;
  await writeFile(file, source, "utf8");
  return NextResponse.json({ ok: true });
}
