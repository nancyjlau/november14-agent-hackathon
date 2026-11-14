"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, Copy, FlaskConical, Heart, HelpCircle, Leaf, LoaderCircle, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { PAPERS } from "@/lib/rizz/papers";
import { craftedReplies } from "@/lib/rizz/generate";
import type { ChatMessage, Generation, Paper, Role, Suggestion, Topic, Vibe } from "@/lib/rizz/types";

const SAMPLE: ChatMessage[] = [
  { id: "demo-1", role: "them", text: "just emerged from a 3-hour transformer lecture 🫠" },
  { id: "demo-2", role: "you", text: "was attention really all you needed?" },
  { id: "demo-3", role: "them", text: "honestly i think i need coffee more ☕" },
];
const OTHER: ChatMessage[] = [
  { id: "alt-1", role: "them", text: "spent all afternoon trying to get this diffusion model to work" },
  { id: "alt-2", role: "you", text: "any progress?" },
  { id: "alt-3", role: "them", text: "just noise so far lol. i need a break and maybe dinner" },
];
type Saved = Suggestion & { paper: Paper; savedAt: number };
type Config = { liffId: string | null; botId: string | null; lineReady: boolean; aiReady: boolean };
type Liff = { init: (p: { liffId: string }) => Promise<void>; isLoggedIn: () => boolean; login: (p?: { redirectUri: string }) => void; getIDToken: () => string | null; shareTargetPicker: (m: unknown[]) => Promise<unknown>; isApiAvailable: (api: string) => boolean };
declare global { interface Window { liff?: Liff } }
function Bloom({ size = 34 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 16C21-3 7 16 20 27 0 25 0 46 22 43c-6 20 17 23 21 4 19 9 29-11 11-20 16-14-2-31-15-16L32 16Z" fill="currentColor"/><path d="M24 29c3-7 8-4 9 0 4-6 11-2 8 4-2 4-9 8-9 8s-8-5-8-9v-3Z" fill="#f5f8ed"/></svg>; }
function OrbitArt() { return <svg viewBox="0 0 260 195" className="orbit-art" fill="none" aria-hidden="true"><ellipse cx="129" cy="95" rx="102" ry="39" transform="rotate(-24 129 95)" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 5"/><ellipse cx="129" cy="95" rx="102" ry="39" transform="rotate(34 129 95)" stroke="currentColor" strokeWidth="1.2"/><path d="M130 125s-42-22-42-47c0-22 28-29 42-8 14-21 42-14 42 8 0 25-42 47-42 47Z" fill="#c3dc94" stroke="#48622d" strokeWidth="1.5"/><circle cx="40" cy="76" r="7" fill="#f2cf9f" stroke="#725c38"/><circle cx="202" cy="50" r="5" fill="#d1dcbf" stroke="#48622d"/><circle cx="193" cy="143" r="6" fill="#d1dcbf" stroke="#48622d"/><path d="m205 17 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Zm-152 119 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#80965d"/><text x="94" y="180" fill="#6e785d" fontSize="11" fontFamily="monospace">p(chemistry) ↑</text></svg>; }
function PaperLink({ paper }: { paper: Paper }) { return <a className="paper-link" href={`https://arxiv.org/abs/${paper.id}`} target="_blank" rel="noreferrer"><BookOpen size={13}/><span>{paper.title}</span><ArrowUpRight size={13}/></a>; }

export default function Home() {
  const [tab, setTab] = useState<"lab" | "papers" | "saved">("lab");
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE);
  const [sample, setSample] = useState(true);
  const [vibe, setVibe] = useState<Vibe>("lowkey");
  const [nerd, setNerd] = useState(2);
  const [topic, setTopic] = useState<Topic>("auto");
  const [result, setResult] = useState<Generation | null>({ suggestions: craftedReplies(SAMPLE, "lowkey", 2, "attention"), papers: [PAPERS[0]], topic: "attention", mode: "crafted", paperSource: "library", boundary: false });
  const [busy, setBusy] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"how" | "line" | "edit" | "privacy" | "copy" | null>(null);
  const [editor, setEditor] = useState("");
  const [draft, setDraft] = useState("");
  const [draftRole, setDraftRole] = useState<Role>("them");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [copied, setCopied] = useState<number | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [lineBusy, setLineBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const variation = useRef(0);
  const run = useRef<AbortController | null>(null);
  const output = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem("rizz-et-al-saved") ?? "[]"); if (Array.isArray(value)) setSaved(value.filter((x) => typeof x?.text === "string" && typeof x?.paper?.id === "string" && /^\d{4}\.\d{4,5}$/.test(x.paper.id)).slice(0, 50)); } catch { /* Storage is optional. */ }
    setSavedLoaded(true);
    fetch("/api/config").then((r) => r.json() as Promise<Config>).then((c) => { setConfig(c); if (c.lineReady && new URLSearchParams(location.search).get("import") === "1") void connectLine(c); }).catch(() => {});
    return () => run.current?.abort();
    // Import is explicit and runs once. No chat polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (savedLoaded) try { localStorage.setItem("rizz-et-al-saved", JSON.stringify(saved)); } catch { setToast("This browser couldn't save the line. Copy it instead."); } }, [saved, savedLoaded]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!busy) return; setLoadingStep(0); const timer = setInterval(() => setLoadingStep((x) => (x + 1) % 3), 2400); return () => clearInterval(timer); }, [busy]);
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close(); }, [modal]);
  function invalidate() { run.current?.abort(); setBusy(false); setResult(null); setError(""); setSample(false); }
  function trySample() { invalidate(); setMessages(messages[0]?.id === "demo-1" ? OTHER : SAMPLE); setSample(true); setShared(false); }
  function edit() { setEditor(messages.map((m) => `${m.role === "you" ? "You" : "Them"}: ${m.text}`).join("\n\n")); setModal("edit"); }
  function applyEditor() {
    const parsed = editor.trim().split(/\n(?=(?:you|them):)/i).map((block, i) => { const m = block.trim().match(/^(you|them):\s*([\s\S]*)$/i); return m && m[2].trim() ? { id: `edit-${Date.now()}-${i}`, role: m[1].toLowerCase() as Role, text: m[2].trim() } : null; });
    if (!parsed.length || parsed.some((m) => !m || m.text.length > 2000) || parsed.length > 12 || parsed.reduce((n, m) => n + (m?.text.length ?? 0), 0) > 8000) { setToast("Use You: or Them: before each message. Up to 12 messages and 8,000 characters."); return; }
    invalidate(); setMessages(parsed as ChatMessage[]); setModal(null);
  }
  function addMessage() {
    if (!draft.trim() || messages.length >= 12) return;
    if (messages.reduce((n, m) => n + m.text.length, 0) + draft.length > 8000) { setToast("Keep it to the recent messages: 8,000 characters max."); return; }
    invalidate(); setMessages((m) => [...m, { id: crypto.randomUUID(), role: draftRole, text: draft.trim() }]); setDraft(""); setAdding(false);
  }
  async function generate() {
    run.current?.abort(); const controller = new AbortController(); run.current = controller;
    setBusy(true); setError(""); setSample(false); setExpanded(null); variation.current += 1;
    try {
      const token = window.liff?.getIDToken();
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ messages, vibe, nerd, topic, variation: variation.current }), signal: controller.signal });
      const data = await response.json() as Generation & { error?: string }; if (!response.ok) throw new Error(data.error || "The lab needs a moment. Try again.");
      setResult(data); setExpanded(0); if (innerWidth < 700) output.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Check your connection and try again."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function copy(text: string, index: number, paper?: Paper) {
    const content = paper ? `${text}\n\n${paper.title}\nhttps://arxiv.org/abs/${paper.id}` : text;
    try { await navigator.clipboard.writeText(content); setCopied(index); setToast(paper ? "Line + citation copied. Make your move." : "Line copied. Make your move."); setTimeout(() => setCopied(null), 1800); }
    catch { setEditor(content); setModal("copy"); }
  }
  function save(line: Suggestion, paper: Paper) { setSaved((old) => old.some((s) => s.text === line.text) ? old.filter((s) => s.text !== line.text) : [{ ...line, paper, savedAt: Date.now() }, ...old].slice(0, 50)); }
  async function share(line: Suggestion, paper: Paper) {
    try { if (window.liff?.isLoggedIn() && window.liff.isApiAvailable("shareTargetPicker")) { const selected = await window.liff.shareTargetPicker([{ type: "text", text: `${line.text}\n\nhttps://arxiv.org/abs/${paper.id}` }]); if (selected) setToast("Shared through LINE."); } else await copy(line.text, 99, paper); }
    catch { setToast("Couldn't share through LINE. You can still copy the line."); }
  }
  async function connectLine(settings: Config | null = config) {
    if (!settings?.lineReady || !settings.liffId) { setModal("line"); return; }
    setLineBusy(true); setError("");
    try {
      if (!window.liff) await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js"; script.async = true; script.onload = () => resolve(); script.onerror = () => { script.remove(); reject(new Error("Couldn't load LINE. Check your connection.")); }; document.head.appendChild(script); });
      const liff = window.liff; if (!liff) throw new Error("LINE couldn't initialize. Try reopening the app.");
      await liff.init({ liffId: settings.liffId });
      if (!liff.isLoggedIn()) { const redirect = new URL(location.href); redirect.searchParams.set("import", "1"); liff.login({ redirectUri: redirect.toString() }); return; }
      const token = liff.getIDToken(); if (!token) throw new Error("The LINE app needs the openid scope enabled.");
      const response = await fetch("/api/context", { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json() as { messages: ChatMessage[]; error?: string }; if (!response.ok) throw new Error(data.error);
      if (!data.messages.length) { setToast("No shared messages yet. Forward a few to the bot, then tap Load from LINE."); return; }
      invalidate(); setMessages(data.messages); setShared(true); setModal(null); setToast("Messages loaded. Tap a speaker label to mark who's talking.");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't connect to LINE."); }
    finally { setLineBusy(false); }
  }
  async function clear() {
    if (shared) { try { const token = window.liff?.getIDToken(); const response = await fetch("/api/context", { method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` } }); if (!response.ok) throw new Error(); } catch { setError("Couldn't delete shared messages. Reopen LINE or send /clear to the bot."); return; } }
    invalidate(); setMessages([]); setShared(false); setToast("Conversation cleared.");
  }

  return <div className="app-shell">
    <header className="site-header"><a href="/" className="brand" aria-label="rizz et al. home"><Bloom/><span>rizz <em>et al.</em><sup>✳</sup></span></a><nav aria-label="Main navigation">{([{ key: "lab", label: "the lab", icon: FlaskConical }, { key: "papers", label: "paper trail", icon: BookOpen }, { key: "saved", label: "saved", icon: Bookmark }] as const).map((n) => <button key={n.key} className={tab === n.key ? "active" : ""} onClick={() => setTab(n.key)}><n.icon size={15}/>{n.label}{n.key === "saved" && saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button>)}</nav><button className="how-button" onClick={() => setModal("how")}><HelpCircle size={16}/><span>how it works</span></button></header>
    {tab === "lab" ? <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><MessageCircle size={13}/>A LITTLE SCIENCE. A LITTLE CHEMISTRY.</div><h1>Make your move.<br/><span>Cite your sources.</span><b className="headline-spark">✳</b></h1><p>For when your crush is into ML and you’re into your crush.<br className="desktop-break"/> Your next text, inspired by actual arXiv papers.</p><div className="hero-meta"><span><i className="status-dot"/>made for LINE</span><i className="meta-divider"/><span>real papers. unserious intentions.</span></div></div><div className="hero-art"><OrbitArt/><span className="art-note">chemistry, with references.</span></div></section>
      <div className="lab-heading"><div><FlaskConical size={15}/>THE EXPERIMENT</div><span>you bring the context. we bring the subtext.</span></div>
      <div className="lab-grid"><section className="context-card" aria-labelledby="context-title"><div className="card-title-row"><div className="section-title"><span className="step-number">01</span><h2 id="context-title">Set the scene</h2></div><span className="tiny-label">{sample ? "SAMPLE CHAT" : shared ? "FROM LINE" : "YOUR CHAT"}</span></div><p className="section-subtitle">A few messages. Just enough to catch the vibe.</p><div className="conversation-top"><span><MessageCircle size={14}/>the conversation</span><div><button onClick={edit} className="text-button">edit</button><button onClick={clear} className="icon-button muted" aria-label="Clear conversation"><Trash2 size={14}/></button></div></div>
        <div className="chat-window"><div className="chat-date">{sample ? "a very plausible conversation" : "tap a label to change the speaker"}</div>{messages.length ? messages.map((m) => <div key={m.id} className={`chat-message ${m.role}`}><button className="speaker-label" title="Switch speaker" onClick={() => { invalidate(); setMessages((old) => old.map((x) => x.id === m.id ? { ...x, role: x.role === "you" ? "them" : "you" } : x)); }}>{m.role}<ChevronDown size={9}/></button><div className="chat-bubble">{m.text}</div></div>) : <div className="empty-chat"><MessageCircle size={26}/><p>Every good line starts<br/>with a little context.</p></div>}{adding && <div className="add-message-form"><div className="sender-switch">{(["them", "you"] as Role[]).map((r) => <button key={r} aria-pressed={draftRole === r} className={draftRole === r ? "selected" : ""} onClick={() => setDraftRole(r)}>{r}</button>)}</div><textarea autoFocus aria-label="Message text" placeholder="what did they say?" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} rows={2}/><div className="add-actions"><button className="text-button" onClick={() => setAdding(false)}>cancel</button><button className="small-button" onClick={addMessage} disabled={!draft.trim()}>add message <Plus size={12}/></button></div></div>}</div>
        <div className="chat-actions"><button className="text-button" disabled={messages.length >= 12} onClick={() => setAdding(true)}><Plus size={13}/>add a message</button><button className="text-button" onClick={trySample}><RefreshCw size={12}/>try a sample</button></div><button className="line-import" onClick={() => connectLine()} disabled={lineBusy}>{lineBusy ? <LoaderCircle size={16} className="spin"/> : <MessageCircle size={16}/>}<span>Load shared messages from LINE</span><ArrowUpRight size={15}/></button><div className="controls-divider"/>
        <div className="field-heading"><label>Pick your energy</label><span>confident, never cringe.*</span></div><div className="vibe-picker">{([{ value: "lowkey", icon: Leaf, desc: "play it cool" }, { value: "playful", icon: Sparkles, desc: "a little banter" }, { value: "bold", icon: Heart, desc: "make it obvious" }] as const).map((v) => <button key={v.value} aria-pressed={vibe === v.value} className={vibe === v.value ? "selected" : ""} onClick={() => { invalidate(); setVibe(v.value); }}><v.icon size={17}/><strong>{v.value}</strong><span>{v.desc}</span></button>)}</div>
        <div className="nerd-control"><div className="field-heading"><label htmlFor="nerd">How deep in the literature?</label><span>{["", "a light reference", "knows their arXiv", "PhD energy"][nerd]}</span></div><input id="nerd" type="range" min="1" max="3" step="1" value={nerd} onChange={(e) => { invalidate(); setNerd(Number(e.target.value)); }}/><div className="range-labels"><span>subtle citation</span><span>full transformer</span></div></div><label className="topic-select"><span>research rabbit hole</span><select aria-label="Research topic" value={topic} onChange={(e) => { invalidate(); setTopic(e.target.value as Topic); }}><option value="auto">let the chat decide</option><option value="attention">attention & transformers</option><option value="diffusion">diffusion & denoising</option><option value="learning">LoRA & meta-learning</option><option value="scaling">scaling & generalization</option><option value="alignment">alignment & RLHF</option></select></label>
        {error && <div className="error-message" role="alert">{error}</div>}<button className="generate-button" onClick={generate} disabled={busy || !messages.length}>{busy ? <LoaderCircle size={18} className="spin"/> : <Sparkles size={18}/>}<span>{busy ? ["reading between the lines…", "checking the literature…", "finding the chemistry…"][loadingStep] : "Find my next line"}</span>{!busy && <ArrowRight size={18}/>}</button><p className="small-print"><ShieldCheck size={12}/>only the messages you share. your chats stay yours.</p>
      </section>
      <section className="results-panel" ref={output} aria-labelledby="results-title" aria-busy={busy}><div className="results-top"><div className="section-title"><span className="step-number">02</span><h2 id="results-title">Make a little chemistry</h2></div><span className="results-flower"><Bloom size={25}/></span></div><p className="section-subtitle">A paper in every line. A little courage in every text.</p>
        {busy ? <div className="loading-results" role="status"><OrbitArt/><h3>{["Reading the room.", "Consulting the literature.", "Checking the references."][loadingStep]}</h3><p>Finding a good detail and a better next text.</p>{[0, 1, 2].map((n) => <div className="skeleton-card" key={n}><div/><div/><div/></div>)}</div> : result?.boundary ? <div className="empty-results"><Leaf size={38}/><h3>Give them a little space.</h3><p>That last message sounds like a boundary.<br/>The best next move is to respect it.</p><button className="outline-button" onClick={() => copy("totally understand. no pressure — take care.", 0)}>copy a considerate reply <Copy size={14}/></button></div> : result ? <><div className="result-meta"><span className="result-count"><i className="status-dot"/>{result.suggestions.length} possible next moves</span><span className="generation-mode">{sample ? "sample replies" : result.mode === "ai" ? "AI-tailored" : "crafted examples"}</span></div><div className="suggestion-list">{result.suggestions.map((line, i) => { const paper = result.papers.find((p) => p.id === line.paperId); if (!paper) return null; const isSaved = saved.some((s) => s.text === line.text); return <article className={`suggestion-card ${i === 0 ? "featured" : ""}`} key={`${line.text}-${i}`}><div className="suggestion-heading"><div><span className="option-number">0{i + 1}</span><span>{line.label}</span>{i === 0 && <span className="little-star">✧</span>}</div><button className={`icon-button ${isSaved ? "is-saved" : ""}`} onClick={() => save(line, paper)} aria-label={isSaved ? "Unsave line" : "Save line"}><Bookmark size={16} fill={isSaved ? "currentColor" : "none"}/></button></div><p className="pickup-line">{line.text}</p><div className="suggestion-bottom"><button className="citation-toggle" aria-expanded={expanded === i} onClick={() => setExpanded(expanded === i ? null : i)}><BookOpen size={13}/><span>{paper.concept}</span><ChevronDown size={12} className={expanded === i ? "rotated" : ""}/></button><button className="copy-button" onClick={() => copy(line.text, i)}>{copied === i ? <Check size={14}/> : <Copy size={14}/>}<span>{copied === i ? "copied" : "copy line"}</span></button></div>{expanded === i && <div className="citation-detail"><span className="citation-eyebrow">THE PAPER BEHIND THE LINE</span><PaperLink paper={paper}/><p className="citation-author">{paper.authors} · {paper.year} · arXiv:{paper.id}</p><p>{line.explanation}</p><div className="citation-extra"><button onClick={() => copy(line.text, i, paper)}>copy with citation <Copy size={11}/></button><button onClick={() => share(line, paper)}>share <Send size={11}/></button></div></div>}</article>; })}</div><div className="result-footer"><span><BookOpen size={13}/>every line has a real paper behind it.</span><button className="text-button" onClick={generate}><RefreshCw size={12}/>another take</button></div>{result.mode === "crafted" && !sample && <p className="crafted-note">Showing crafted examples matched to your topic. Connect AI to tailor each line to your exact conversation.</p>}</> : <div className="empty-results"><OrbitArt/><h3>The next move is yours.</h3><p>Set the scene, pick your energy,<br/>and let the literature do a little flirting.</p><span className="empty-annotation">← your co-author starts here</span></div>}
        <aside className="research-note"><span className="note-pin">✳</span><div><span className="note-title">A note from the authors</span><p>The ML is real. The chemistry is up to you.<br/>We borrow ideas from papers, not dating advice.</p></div><Heart size={27}/></aside>
      </section></div><div className="under-lab"><span>*some cringe is statistically inevitable.</span><span>less “hey”. more hypothesis.</span></div>
    </main> : <main className="collection-page"><button className="back-button" onClick={() => setTab("lab")}><ArrowLeft size={14}/>back to the lab</button><div className="eyebrow">{tab === "papers" ? "THE REFERENCES SECTION" : "FOR YOUR NEXT MOVE"}</div><h1>{tab === "papers" ? <>A good line has<br/><span>a paper trail.</span></> : <>Your saved<br/><span>hypotheses.</span></>}</h1><p className="collection-intro">{tab === "papers" ? "Real research. Questionable applications. Meet the papers behind the flirting." : "Lines you bookmarked, saved on this browser. Your conversation isn't stored here."}</p>{tab === "papers" ? <div className="paper-grid">{PAPERS.map((p, i) => <article className="library-card" key={p.id}><div className="library-card-top"><span>REF. {String(i + 1).padStart(2, "0")}</span><span>{p.year}</span></div><BookOpen size={23}/><h2>{p.title}</h2><span className="library-authors">{p.authors}</span><p>{p.summary}</p><PaperLink paper={p}/><button className="text-button paper-use" onClick={() => { invalidate(); setTopic(p.topics[0]); setTab("lab"); }}>flirt with this idea <ArrowRight size={13}/></button></article>)}</div> : saved.length ? <div className="saved-grid">{saved.map((s, i) => <article className="suggestion-card" key={`${s.text}-${s.savedAt}`}><div className="suggestion-heading"><span className="tiny-label">SAVED FOR LATER</span><button className="icon-button is-saved" onClick={() => save(s, s.paper)} aria-label="Unsave line"><Bookmark size={16} fill="currentColor"/></button></div><p className="pickup-line">{s.text}</p><PaperLink paper={s.paper}/><div className="saved-actions"><button className="copy-button" onClick={() => copy(s.text, i)}><Copy size={13}/>copy line</button><button className="text-button" onClick={() => copy(s.text, i, s.paper)}>include citation <ArrowUpRight size={12}/></button></div></article>)}</div> : <div className="empty-saved"><Bookmark size={36}/><h2>No hypotheses saved. Yet.</h2><p>Tap the bookmark on a line you like.<br/>It’ll be here when you need a little courage.</p><button className="outline-button" onClick={() => setTab("lab")}>find a line <ArrowRight size={14}/></button></div>}</main>}
    <footer className="site-footer"><a href="/" className="footer-brand">rizz <em>et al.</em><Bloom size={18}/></a><p>an independent experiment in applied chemistry.</p><button onClick={() => setModal("privacy")}>a little privacy <ArrowUpRight size={11}/></button></footer>
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
    <dialog ref={dialog} onCancel={() => setModal(null)} onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }} className="app-dialog"><button className="dialog-close icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={20}/></button>
      {modal === "how" && <><span className="dialog-kicker">A VERY SHORT METHODOLOGY</span><h2>A little context.<br/>A better next text.</h2><ol className="how-steps"><li><span>01</span><div><h3>Bring the conversation</h3><p>Forward a few text messages to the rizz et al. LINE bot, then open the app. Or enter them here. Mark who said what.</p></div></li><li><span>02</span><div><h3>Choose your energy</h3><p>Lowkey, playful, or bold. Choose how deep to go in the literature.</p></div></li><li><span>03</span><div><h3>Make your move</h3><p>Every line uses a concrete idea from a real paper. Open its reference to see the connection. Copy it with or without the citation.</p></div></li></ol><button className="generate-button" onClick={() => setModal(null)}>back to the experiment <ArrowRight size={16}/></button></>}
      {modal === "line" && <><span className="dialog-kicker">A LITTLE LINE CONNECTION</span><h2>Your messages.<br/>Shared on your terms.</h2><p>This preview works now. The LINE bot hasn’t been connected yet.</p><div className="connection-explainer"><MessageCircle size={24}/><span>Once connected: select messages → forward to our bot → tap “Open app”. No copying and pasting.</span></div><p>Opening the app never gives it access to your chat history. It only sees text you choose to share.</p>{config?.botId && <a className="outline-button" href={`https://line.me/R/ti/p/${encodeURIComponent(config.botId)}`} target="_blank" rel="noreferrer">add the LINE bot <ArrowUpRight size={15}/></a>}<button className="generate-button" onClick={() => { setModal(null); trySample(); }}>try a sample conversation <ArrowRight size={16}/></button></>}
      {(modal === "edit" || modal === "copy") && <><span className="dialog-kicker">{modal === "edit" ? "GIVE US THE CONTEXT" : "YOUR NEXT LINE"}</span><h2>{modal === "edit" ? "The conversation" : "Make your move."}</h2><p>{modal === "edit" ? <>Start each message with <strong>You:</strong> or <strong>Them:</strong>. A few recent messages work best.</> : "Select the text below to copy it."}</p><textarea className="conversation-editor" aria-label={modal === "edit" ? "Edit conversation" : "Copy text"} value={editor} onChange={(e) => setEditor(e.target.value)} rows={9} maxLength={9000}/>{modal === "edit" && <button className="generate-button" onClick={applyEditor}>use these messages <Check size={17}/></button>}</>}
      {modal === "privacy" && <><span className="dialog-kicker">YOUR CHAT ISN’T OUR BUSINESS</span><h2>A little privacy.</h2><div className="privacy-copy"><p>This app can’t read LINE history. It uses only text you explicitly share with its bot or enter here.</p><p>Forwarded messages are scoped to your verified LINE identity. Only the latest 12 are kept, and they expire after 24 hours. Send <strong>/clear</strong> to the bot or clear a loaded conversation to delete them.</p><p>Browser-entered conversations aren’t saved. With AI tailoring enabled, your selected messages are sent to OpenAI with storage disabled. arXiv receives a research-topic query, never your conversation.</p><p>Saved lines stay in this browser until you remove them. They include the reply and paper, not your conversation.</p></div><button className="outline-button" onClick={() => setModal(null)}>sounds good <Check size={15}/></button></>}
    </dialog>
  </div>;
}
