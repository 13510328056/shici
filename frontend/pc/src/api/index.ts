/** API 客户端 */

import axios from 'axios'
import type { PlaceName, PoetTrajectory, HeatmapPoint } from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

/** 搜索地名（古今模糊查询） */
export async function searchPlaces(q: string) {
  const res = await api.get('/places/search', { params: { q } })
  return res.data.results as PlaceName[]
}

/** 围栏查询：给定坐标+半径内所有地名 */
export async function fenceQuery(lon: number, lat: number, radius = 80) {
  const res = await api.get('/places/fence', { params: { lon, lat, radius } })
  return res.data as { center: { lon: number; lat: number }; radius_km: number; places: PlaceName[] }
}

/** 诗人轨迹 */
export async function getPoetTrajectory(poetId: string, yearStart?: string, yearEnd?: string) {
  const res = await api.get(`/poets/${poetId}/trajectory`, {
    params: { year_start: yearStart, year_end: yearEnd },
  })
  return res.data as PoetTrajectory
}

/** 诗词热力 */
export async function getHeatmap(dynasty?: string, mood?: string) {
  const res = await api.get('/poets/heatmap', { params: { dynasty, mood } })
  return res.data as { count: number; points: HeatmapPoint[] }
}

/** 诗人列表（获取所有诗人） */
export async function listPoets() {
  const res = await api.get('/poets')
  return res.data as { poets: Array<{ poet_id: string; name: string; dynasty: string }> }
}

export default api
