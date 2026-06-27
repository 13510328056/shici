/** API 客户端 */

import axios from 'axios'
import type { PlaceName, HeatmapPoint } from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

// 响应拦截器 — 统一错误处理
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const { status, data } = error.response
      if (status === 401 || status === 403) {
        console.warn('[API] 认证错误:', status, data?.detail || '')
      } else if (status === 500) {
        console.error('[API] 服务器错误:', data?.detail || data?.error || '未知错误')
      }
    } else if (error.request) {
      console.error('[API] 网络错误: 无法连接到服务器')
    }
    return Promise.reject(error)
  }
)

/** 搜索地名（古今模糊查询） */

/** 围栏查询：给定坐标+半径内所有地名 */
export async function fenceQuery(lon: number, lat: number, radius = 80) {
  const res = await api.get('/places/fence', { params: { lon, lat, radius } })
  return res.data as { center: { lon: number; lat: number }; radius_km: number; places: PlaceName[] }
}

/** 诗人轨迹 */

/** 诗词热力 */
export async function getHeatmap(dynasty?: string, mood?: string) {
  const res = await api.get('/poets/heatmap', { params: { dynasty, mood } })
  return res.data as { count: number; points: HeatmapPoint[] }
}

/** 诗人列表（获取所有诗人） */

export default api
