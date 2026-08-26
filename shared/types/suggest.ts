/** Knowledge Radar 契约（M3.5-A，ADR-012）。 */

export interface SuggestionMatch {
  type: "note" | "concept";
  id: number;
  title: string;
  snippet: string | null;
  score: number;
  /** concept 独有 */
  domain?: string | null;
  status?: string | null;
}

export interface SuggestionRelated {
  title: string;
  relation: string;
}

export interface SuggestionMemory {
  mastery: number | null;
  review_due: string | null;
  last_mistake: string | null;
}

export interface SuggestionResponse {
  matches: SuggestionMatch[];
  related: SuggestionRelated[];
  memory: SuggestionMemory;
}
