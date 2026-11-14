import { database, errorResponse, json, lineUser, pruneMessages } from "@/lib/rizz/server";
export async function GET(request: Request) {
  try {
    const user = await lineUser(request); const db = database(); await pruneMessages(db);
    const result = await db.prepare("SELECT id, content FROM shared_messages WHERE user_id = ? AND expires_at > ? ORDER BY received_at DESC, id DESC LIMIT 12").bind(user, Date.now()).all<{ id: string; content: string }>();
    return json({ messages: result.results.reverse().map((m) => ({ id: m.id, role: "them", text: m.content })), note: "Forwarded messages don't preserve speaker labels. Tap a label to mark your own messages." });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    const user = await lineUser(request);
    await database().prepare("DELETE FROM shared_messages WHERE user_id = ?").bind(user).run();
    return json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}
