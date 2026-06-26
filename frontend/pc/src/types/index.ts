/** 项目全局类型定义 */

export interface PlaceName {
  place_id: string
  ancient_name: string
  modern_name: string
  wgs84_lon: number
  wgs84_lat: number
  province: string | null
  city: string | null
  admin_level: number
  distance_km?: number
}

export interface Poet {
  poet_id: string
  name: string
  birth_year: string
  death_year: string
  dynasty: string
  tags: string[]
}

export interface TrajectoryEvent {
  id: string
  event_year: string
  ancient_place: string | null
  wgs84_lon: number | null
  wgs84_lat: number | null
  event_type: string
  stay_duration_days: number | null
  source: string | null
}

export interface PoetTrajectory {
  poet_id: string
  year_range: { start: string | null; end: string | null }
  events: TrajectoryEvent[]
}

export interface PoetryItem {
  poetry_id: string
  title: string
  author: string
  dynasty: string
  content: string
  genre: string | null
  mood_tags: string[]
}

export interface HeatmapPoint {
  place_id: string
  ancient_name: string
  modern_name: string
  wgs84_lon: number
  wgs84_lat: number
  province: string
  poetry_count: number
}

/** 地图图层类型 */
export type MapLayerType = 'places' | 'poets' | 'poetry' | 'heatmap' | 'encounter'

/** 事件类型颜色映射 */
export const EVENT_COLORS: Record<string, string> = {
  '出生': '#2196F3',
  '科举': '#4CAF50',
  '仕宦': '#FF9800',
  '贬谪': '#F44336',
  '游览': '#9C27B0',
  '创作': '#00BCD4',
  '雅集': '#FFEB3B',
}
