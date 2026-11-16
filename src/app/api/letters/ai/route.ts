import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

const systemPrompt = (orn: string, trn: string) =>
  `You draft formal business letters for Citiway Real Estate Brokerage L.L.C., a RERA-registered real estate brokerage in Dubai, UAE (License No. 726153, DED${orn ? `; RERA ORN ${orn}` : ""}${trn ? `; TRN ${trn}` : ""}; Office No. 205, Bayswater Tower, Business Bay, Dubai).
Return ONLY a JSON object, no prose, with these keys:
{"to": string (recipient lines separated by \\n),
 "address": string,
 "attention": string,
 "subject": string (concise, no "Subject:" prefix),
 "salutation": string (e.g. "Dear Sir / Madam," or "" for To Whom It May Concern certificates),
 "body": string (2-5 formal paragraphs separated by \\n\\n; UAE business register; do NOT include salutation, sign-off or signature),
 "tableOn": boolean,
 "rows": [{"k": label, "v": value}] (leave v "" when unknown — never invent personal data),
 "signoff": string, "signName": string or "", "signTitle": string or ""}
Write in the language the user requests (English by default; Arabic if asked). Use "[placeholder]" for any required detail the user did not provide.`;

export async function POST(request: NextRequest) {
  // Only signed-in CRM users may spend AI credits.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: { prompt?: unknown; orn?: unknown; trn?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 4000) {
    return NextResponse.json({ error: "Prompt is required (max 4000 chars)." }, { status: 400 });
  }
  const orn = typeof body.orn === "string" ? body.orn.slice(0, 40) : "";
  const trn = typeof body.trn === "string" ? body.trn.slice(0, 40) : "";

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt(orn, trn),
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The AI response did not contain JSON.");
    return NextResponse.json({ draft: JSON.parse(m[0]) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 502 },
    );
  }
}
