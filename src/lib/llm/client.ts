import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var.");
  client = new Anthropic({ apiKey });
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/**
 * Calls the model with a system prompt that forces JSON-only output,
 * and parses the result. Throws a descriptive error on malformed JSON
 * so callers can mark extraction as "failed" instead of silently
 * storing garbage.
 */
export async function extractJSON<T>(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 2000,
    system:
      params.system +
      "\n\nRespond with ONLY valid JSON. No markdown fences, no preamble, no commentary.",
    messages: [{ role: "user", content: params.user }]
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Model did not return valid JSON: ${(err as Error).message}. Raw output (truncated): ${cleaned.slice(0, 300)}`
    );
  }
}
