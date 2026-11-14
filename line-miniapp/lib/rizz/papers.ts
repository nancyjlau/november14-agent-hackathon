import type { Paper, Topic } from "./types";

// A small, verified reference library also keeps the app useful when arXiv is slow.
// These descriptions summarize ML concepts; none makes claims about human attraction.
export const PAPERS: Paper[] = [
  { id: "1706.03762", title: "Attention Is All You Need", authors: "Vaswani et al.", year: 2017,
    concept: "Attention", topics: ["attention"],
    summary: "The base Transformer uses eight attention heads. Its attention mechanism matches queries with keys to weight values. It replaces recurrent layers with attention, enabling parallel processing of a sequence." },
  { id: "2006.11239", title: "Denoising Diffusion Probabilistic Models", authors: "Ho, Jain & Abbeel", year: 2020,
    concept: "Denoising", topics: ["diffusion"],
    summary: "A diffusion model learns to reverse a gradual noising process, turning noise into structured samples." },
  { id: "1703.03400", title: "Model-Agnostic Meta-Learning for Fast Adaptation of Deep Networks", authors: "Finn, Abbeel & Levine", year: 2017,
    concept: "Learning to learn", topics: ["learning"],
    summary: "MAML learns an initialization that can adapt to a new task with only a small number of gradient steps." },
  { id: "2201.02177", title: "Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets", authors: "Power et al.", year: 2022,
    concept: "Beyond memorization", topics: ["scaling", "learning"],
    summary: "On small algorithmic datasets, networks can memorize training examples long before they suddenly generalize to unseen ones. Continued training after overfitting can lead to this delayed generalization, called grokking." },
  { id: "2106.09685", title: "LoRA: Low-Rank Adaptation of Large Language Models", authors: "Hu et al.", year: 2021,
    concept: "A little adaptation", topics: ["learning"],
    summary: "LoRA freezes pretrained weights and learns low-rank update matrices. In its GPT-3 comparison, it uses 10,000 times fewer trainable parameters and three times less GPU memory than full fine-tuning." },
  { id: "2010.11929", title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale", authors: "Dosovitskiy et al.", year: 2020,
    concept: "Seeing the bigger picture", topics: ["attention"],
    summary: "The Vision Transformer treats an image as a sequence of patches and applies a Transformer to image classification." },
  { id: "2203.02155", title: "Training language models to follow instructions with human feedback", authors: "Ouyang et al.", year: 2022,
    concept: "Human feedback", topics: ["alignment"],
    summary: "InstructGPT uses demonstrations, preference comparisons, and reinforcement learning from human feedback to better follow user intent." },
  { id: "2005.14165", title: "Language Models are Few-Shot Learners", authors: "Brown et al.", year: 2020,
    concept: "175 billion parameters", topics: ["scaling"],
    summary: "GPT-3 has 175 billion parameters. The paper evaluates its ability to perform new tasks from examples in a prompt, without gradient updates or task-specific fine-tuning." },
  { id: "2203.15556", title: "Training Compute-Optimal Large Language Models", authors: "Hoffmann et al.", year: 2022,
    concept: "The Chinchilla tradeoff", topics: ["scaling"],
    summary: "Chinchilla has 70 billion parameters and was trained on 1.4 trillion tokens. It outperforms the larger Gopher model on many evaluated tasks using the same training compute budget and four times as much data." },
];

const queries: Record<Exclude<Topic, "auto">, string> = {
  attention: 'ti:"Attention Is All You Need"',
  diffusion: 'ti:"Denoising Diffusion Probabilistic Models"',
  learning: 'ti:"Low-Rank Adaptation" OR ti:"Model-Agnostic Meta-Learning"',
  scaling: 'ti:"Grokking" OR ti:"Training Compute-Optimal Large Language Models" OR ti:"Language Models are Few-Shot Learners"',
  alignment: 'ti:"Training language models to follow instructions with human feedback"',
};
const tavilyQueries: Record<Exclude<Topic, "auto">, string> = {
  attention: "transformer attention mechanism paper",
  diffusion: "denoising diffusion generative model paper",
  learning: "meta-learning parameter-efficient fine-tuning paper",
  scaling: "scaling laws large language models generalization paper",
  alignment: "reinforcement learning from human feedback language model alignment paper",
};
const mlCategories = "cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:stat.ML OR cat:cs.AI";
type PaperResult = { papers: Paper[]; source: "tavily" | "arxiv" | "library" };
const cache = new Map<Topic, { expires: number; value: PaperResult }>();
let pending: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

export function topicFromChat(text: string): Exclude<Topic, "auto"> {
  if (/diffusion|noise|noisy|chaos|mess|art|paint|photo|image/i.test(text)) return "diffusion";
  if (/grok|scaling|chinchilla|gpt|memor|overfit|generaliz/i.test(text)) return "scaling";
  if (/feedback|reward|reinforce|align|preference/i.test(text)) return "alignment";
  if (/learn|study|exam|adapt|train|fine.?tun|lora/i.test(text)) return "learning";
  return "attention";
}

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ").trim();
}

export function parseArxiv(xml: string, topic: Topic): Paper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.flatMap((entry) => {
    const read = (tag: string) => decodeXml(entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? "");
    const id = read("id").match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(?:v\d+)?$/)?.[1];
    if (!id || !read("title")) return [];
    const known = PAPERS.find((p) => p.id === id);
    const names = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => decodeXml(m[1]));
    return [{ id, title: read("title"), authors: known?.authors ?? (names.slice(0, 2).join(", ") + (names.length > 2 ? " et al." : "")),
      year: Number(read("published").slice(0, 4)) || new Date().getFullYear(),
      summary: known?.summary ?? read("summary").slice(0, 800),
      concept: known?.concept ?? "Related research", topics: [topic] }];
  });
}

/** Searches arxiv.org through Tavily and returns up to four distinct arXiv IDs for the topic. */
async function tavilyArxivIds(key: string, topic: Exclude<Topic, "auto">): Promise<string[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST", signal: AbortSignal.timeout(6500),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: tavilyQueries[topic], include_domains: ["arxiv.org"], search_depth: "basic", max_results: 8 }),
  });
  if (!response.ok) return [];
  const { results } = await response.json() as { results: { url: string }[] };
  const ids = results.flatMap((r) => r.url.match(/arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})/)?.[1] ?? []);
  return [...new Set(ids)].slice(0, 4);
}

export async function findPapers(topic: Exclude<Topic, "auto">, tavilyKey?: string): Promise<PaperResult> {
  const cached = cache.get(topic);
  if (cached && cached.expires > Date.now()) return cached.value;
  const fallback: PaperResult = { papers: PAPERS.filter((p) => p.topics.includes(topic)), source: "library" };
  // Serialize API queries and space them by 3 seconds, following arXiv's API guidance.
  const job = pending.catch(() => {}).then(async () => {
    const secondCheck = cache.get(topic);
    if (secondCheck && secondCheck.expires > Date.now()) return secondCheck.value;
    // Tavily only discovers IDs; arXiv supplies the metadata, so every citation still resolves to a real paper.
    // A Tavily failure falls back to the fixed arXiv title query.
    const ids = tavilyKey ? await tavilyArxivIds(tavilyKey, topic).catch(() => []) : [];
    const delay = Math.max(0, 3100 - (Date.now() - lastRequest));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequest = Date.now();
    let value = fallback;
    try {
      const url = new URL("https://export.arxiv.org/api/query");
      if (ids.length) {
        url.searchParams.set("id_list", ids.join(","));
        url.searchParams.set("search_query", mlCategories);
      } else url.searchParams.set("search_query", `(${queries[topic]}) AND (${mlCategories})`);
      url.searchParams.set("max_results", String(ids.length || 3));
      const response = await fetch(url, { signal: AbortSignal.timeout(6500), headers: { "User-Agent": "rizz et al./1.0 (arXiv-backed conversation companion)" } });
      if (response.ok) {
        const papers = parseArxiv(await response.text(), topic);
        if (papers.length) value = { papers, source: ids.length ? "tavily" : "arxiv" };
      }
    } catch { /* The verified library is available during an arXiv outage. */ }
    cache.set(topic, { expires: Date.now() + (value.source === "library" ? 300_000 : 3_600_000), value });
    return value;
  });
  pending = job;
  return job;
}
