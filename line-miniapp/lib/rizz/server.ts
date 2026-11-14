import { env } from "cloudflare:workers";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  return json({ error: "Something went wrong. Please try again in a moment." }, 500);
}
export async function readJson(request: Request, max = 32000) {
  if (Number(request.headers.get("content-length")) > max) throw new HttpError(413, "That conversation is too long. Share just the recent messages.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); throw new HttpError(413, "That conversation is too long."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, "Please send valid JSON."); }
}
export async function lineUser(request: Request): Promise<string> {
  if (!env.LIFF_CHANNEL_ID) throw new HttpError(503, "LINE connection is not configured yet. You can still try the sample chat.");
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.length > 10000) throw new HttpError(401, "Open this app through LINE to load your shared messages.");
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST", signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: token, client_id: env.LIFF_CHANNEL_ID }),
  });
  if (!response.ok) throw new HttpError(401, "Your LINE session expired. Please reopen the app.");
  const result = await response.json() as { sub?: string; aud?: string; exp?: number };
  if (!result.sub || result.aud !== env.LIFF_CHANNEL_ID || !result.exp || result.exp * 1000 <= Date.now()) throw new HttpError(401, "Your LINE session could not be verified.");
  return result.sub;
}
export function database() {
  if (!env.DB) throw new HttpError(503, "Shared-message storage is not connected yet.");
  return env.DB;
}
export async function pruneMessages(db: D1Database) {
  await db.prepare("DELETE FROM shared_messages WHERE expires_at <= ?").bind(Date.now()).run();
}
export async function rateLimit(key: string) {
  const db = database(); const now = Date.now();
  const row = await db.prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END,
    window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END
    RETURNING count`).bind(key, now, now - 60000, now - 60000).first<{ count: number }>();
  if (row && row.count > 10) throw new HttpError(429, "Give the lab a moment. Try again in a minute.");
}

export async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    if (!signature || signature.length > 128) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)), new TextEncoder().encode(body));
  } catch { return false; }
}

export async function replyToLine(replyToken: string, text: string, open = true) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new HttpError(503, "The LINE bot token is not configured.");
  const id = env.LIFF_ID;
  const messages: unknown[] = [{ type: "text", text }];
  if (open && id) messages.push({ type: "template", altText: "Open rizz et al.", template: {
    type: "buttons", text: "your next line is one tap away.", actions: [{ type: "uri", label: "Open rizz et al.", uri: `https://liff.line.me/${id}?import=1` }],
  } });
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) throw new HttpError(502, "LINE could not receive the app link. Try sending /open.");
}
