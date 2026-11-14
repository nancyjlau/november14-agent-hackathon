export type Role = "you" | "them";
export type ChatMessage = { id: string; role: Role; text: string };
export type Vibe = "lowkey" | "playful" | "bold";
export type Topic = "auto" | "attention" | "diffusion" | "learning" | "scaling" | "alignment";
export type Paper = {
  id: string; title: string; authors: string; year: number;
  concept: string; summary: string; topics: Topic[];
};
export type Suggestion = { text: string; paperId: string; explanation: string; label: string };
export type Generation = {
  suggestions: Suggestion[]; papers: Paper[]; topic: Topic;
  mode: "ai" | "crafted"; paperSource: "tavily" | "arxiv" | "library";
  boundary: boolean;
};
