import { env } from "cloudflare:workers";
import { database, errorResponse, HttpError, json, pruneMessages, replyToLine, verifySignature } from "@/lib/rizz/server";
type LineEvent = { type: string; replyToken?: string; source?: { type?: string; userId?: string }; message?: { type?: string; id?: string; text?: string }; unsend?: { messageId?: string }; timestamp?: number };
export async function POST(request: Request) {
  try {
    if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN || !env.LIFF_ID) throw new HttpError(503, "LINE setup is incomplete.");
    if (Number(request.headers.get("content-length")) > 128000) throw new HttpError(413, "Payload too large.");
    // Verify the exact raw bytes before parsing or mutating data.
    const raw = await request.text();
    if (raw.length > 128000) throw new HttpError(413, "Payload too large.");
    if (!await verifySignature(raw, request.headers.get("x-line-signature") ?? "", env.LINE_CHANNEL_SECRET)) throw new HttpError(401, "Invalid LINE signature.");
    let payload: { events?: LineEvent[] };
    try { payload = JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON."); }
    if (!Array.isArray(payload.events)) throw new HttpError(400, "Expected LINE events.");
    if (!payload.events.length) return json({ ok: true }); // LINE's Verify request.
    const db = database(); await pruneMessages(db);
    for (const event of payload.events.slice(0, 100)) {
      const user = event.source?.userId;
      if (!user || event.source?.type !== "user") continue; // Only intentionally shared DMs, never whole groups.
      if (event.type === "unfollow") {
        await db.prepare("DELETE FROM shared_messages WHERE user_id = ?").bind(user).run(); continue;
      }
      if (event.type === "unsend" && event.unsend?.messageId) {
        await db.prepare("DELETE FROM shared_messages WHERE user_id = ? AND id = ?").bind(user, event.unsend.messageId).run(); continue;
      }
      if (event.type === "follow" && event.replyToken) {
        await replyToLine(event.replyToken, "hey, welcome to rizz et al. 🌱\n\nForward a few messages from your conversation here, then open the app. We’ll find you a lowkey ML-inspired reply with a real arXiv reference.\n\nSend /open for the app, or /clear to delete shared messages. Shared context expires after 24 hours."); continue;
      }
      if (event.type !== "message" || !event.replyToken) continue;
      if (event.message?.type !== "text" || !event.message.text || !event.message.id) {
        await replyToLine(event.replyToken, "For now, send or forward text messages. You can also type them in the app."); continue;
      }
      const text = event.message.text.trim();
      if (/^\/(clear|reset)$/i.test(text)) {
        await db.prepare("DELETE FROM shared_messages WHERE user_id = ?").bind(user).run();
        await replyToLine(event.replyToken, "Shared messages deleted. Fresh start 🌱", false); continue;
      }
      if (/^\/(open|start|help)$/i.test(text)) {
        await replyToLine(event.replyToken, "Forward the messages you want help with, then open the app. Tap the You/Them labels to fix who's speaking."); continue;
      }
      const result = await db.prepare("INSERT OR IGNORE INTO shared_messages (id, user_id, content, received_at, expires_at) VALUES (?, ?, ?, ?, ?)")
        .bind(event.message.id, user, text.slice(0, 2000), event.timestamp ?? Date.now(), Date.now() + 86_400_000).run();
      if (!result.meta.changes) continue; // Message redelivery must not duplicate context.
      await db.prepare("DELETE FROM shared_messages WHERE user_id = ? AND id NOT IN (SELECT id FROM shared_messages WHERE user_id = ? ORDER BY received_at DESC, id DESC LIMIT 12)").bind(user, user).run();
      const prompt = await db.prepare(`INSERT INTO bot_prompts (user_id, prompted_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET prompted_at = excluded.prompted_at WHERE bot_prompts.prompted_at < ? RETURNING user_id`)
        .bind(user, Date.now(), Date.now() - 30000).first();
      if (prompt) {
        try { await replyToLine(event.replyToken, "got it. send any other messages, then open the lab 🧪\n\nTap You/Them in the app to label the speakers."); }
        catch { await db.prepare("DELETE FROM bot_prompts WHERE user_id = ?").bind(user).run(); throw new HttpError(502, "Messages saved, but the app link could not be delivered. Send /open to retry."); }
      }
    }
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
