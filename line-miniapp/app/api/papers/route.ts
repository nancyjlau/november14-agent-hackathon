import { PAPERS } from "@/lib/rizz/papers";
import { json } from "@/lib/rizz/server";
export function GET() { return json({ papers: PAPERS }); }
