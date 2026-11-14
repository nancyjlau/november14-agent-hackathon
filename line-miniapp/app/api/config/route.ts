import { env } from "cloudflare:workers";
import { json } from "@/lib/rizz/server";
export function GET() {
  return json({ liffId: env.LIFF_ID ?? null,
    botId: env.LINE_BOT_BASIC_ID ?? null,
    lineReady: Boolean(env.LIFF_ID && env.LIFF_CHANNEL_ID && env.LINE_CHANNEL_SECRET && env.LINE_CHANNEL_ACCESS_TOKEN && env.DB),
    aiReady: Boolean(env.OPENAI_API_KEY) });
}
