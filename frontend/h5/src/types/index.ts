export interface Poet {
  poet_id: string
  name: string
  dynasty: string
  birth_year?: string
  death_year?: string
  tags?: string[]
  description?: string
}

export interface Poem {
  poetry_id: string
  title: string
  content: string
  author: string
  author_id?: string
  dynasty: string
  genre?: string
  mood_tags?: string[]
  imagery_items?: string[]
  season?: string[]
  difficulty?: string
  rating?: number
}

export interface DailyPoem extends Poem {
  date: string
  reason?: string
  priority?: number
  difficulty?: string
}

export interface GenreMeta {
  genre_type: string
  name: string
  subtitle: string
  description: string
  background: string
  characteristics: string[]
  sub_genres: { name: string; count: number }[]
  famous_lines: { line: string; source: string; author: string }[]
  stats: { total_poems: number; total_poets: number }
  poems: Poem[]
  representative_poets: { name: string; poet_id: string; poem_count: number; dynasty: string }[]
}

export interface PoetStats {
  poet_id: string
  total_cities: number
  total_poems: number
  poems_by_city: { city: string; count: number }[]
  duration_by_type: { type: string; days: number; events: number }[]
}

export interface MatchReason {
  field: string
  label: string
}

export interface SearchRelevance {
  score: number
  reasons: MatchReason[]
}

export interface SearchPoem extends Poem {
  relevance: SearchRelevance
}

export interface UnifiedSearchResult {
  poets: Poet[]
  poems: SearchPoem[]
  total: number
}
