import { env } from "cloudflare:workers";
import { z } from "zod";
import { boundaryResult, chooseTopic, craftedReplies, generateWithAI, respectsBoundary } from "@/lib/rizz/generate";
import { findPapers, PAPERS } from "@/lib/rizz/papers";
import { errorResponse, HttpError, json, lineUser, rateLimit, readJson } from "@/lib/rizz/server";
const inputSchema = z.object({
  messages: z.array(z.object({ id: z.string().max(150), role: z.enum(["you", "them"]), text: z.string().trim().min(1).max(2000) })).min(1).max(12),
  vibe: z.enum(["lowkey", "playful", "bold"]), nerd: z.number().int().min(1).max(3),
  topic: z.enum(["auto", "attention", "diffusion", "learning", "scaling", "alignment"]),
  variation: z.number().int().min(0).max(1000000).default(0),
});
export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "Add 1–12 messages, then choose a vibe.");
    const { messages, vibe, nerd, topic: selected, variation } = parsed.data;
    if (messages.reduce((n, m) => n + m.text.length, 0) > 8000) throw new HttpError(400, "Keep the conversation under 8,000 characters.");
    if (!messages.some((m) => m.role === "them")) throw new HttpError(400, "Label at least one message as Them so we know what you're replying to.");
    if (respectsBoundary(messages)) return json(boundaryResult());
    let aiAuthorized = Boolean(request.headers.get("oai-authenticated-user-id")) || env.ALLOW_ANONYMOUS_AI === "true";
    if (env.OPENAI_API_KEY && env.LIFF_CHANNEL_ID && request.headers.has("authorization")) {
      const user = await lineUser(request); await rateLimit(`generate:${user}`); aiAuthorized = true;
    }
    const topic = chooseTopic(messages, selected);
    const { papers, source } = env.OPENAI_API_KEY && aiAuthorized ? await findPapers(topic) : { papers: PAPERS.filter((p) => p.topics.includes(topic)), source: "library" as const };
    const ai = env.OPENAI_API_KEY && aiAuthorized ? await generateWithAI(env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4.1-mini", messages, vibe, nerd, papers) : null;
    const suggestions = ai ?? craftedReplies(messages, vibe, nerd, topic, variation);
    const used = new Set(suggestions.map((s) => s.paperId));
    const refs = [...papers, ...PAPERS].filter((p, i, a) => used.has(p.id) && a.findIndex((q) => q.id === p.id) === i);
    return json({ suggestions, papers: refs, topic, mode: ai ? "ai" : "crafted", paperSource: ai ? source : "library", boundary: false });
  } catch (error) { return errorResponse(error); }
}
