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
  dynasty: string
  genre?: string
  mood_tags?: string[]
  imagery_items?: string[]
  season?: string[]
  rating?: number
}

export interface DailyPoem extends Poem {
  date: string
}

export interface PoetStats {
  poet_id: string
  total_cities: number
  total_poems: number
  poems_by_city: { city: string; count: number }[]
  duration_by_type: { type: string; days: number; events: number }[]
}
