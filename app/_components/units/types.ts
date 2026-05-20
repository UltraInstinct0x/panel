// shared renderer contract for per-type unit views.
// behavioral collection + submit stays in Widget — renderers just call onAnswer(choice).

export type UnitType =
  | 'pairwise_trace' | 'step_validity' | 'skill_diff' | 'hallucination_flag'
  | 'taste_rank' | 'sarcasm_detect' | 'ai_vs_real' | 'dub_sync'
  | 'drag_to_rank' | 'span_highlight';

export type RendererUnit = {
  id: string;
  type: UnitType;
  pool: 'public' | 'technical';
  source_agent: string;
  prompt_context: string;
  question: string;
  choices?: { label: string; text: string }[];
  binary?: { yes: string; no: string };
  diff?: string;
  video_url?: string;
  audio_offset_ms?: number;
  items?: { label: string; text: string }[];
  passage?: string;
  image_url?: string;
  est_seconds: number;
};

export type RendererProps = {
  unit: RendererUnit;
  onAnswer: (choice: string) => void;
  disabled: boolean;
};

// deterministic 32-bit hash of unit.id — used for avatar colors / faux usernames
export function hashId(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
