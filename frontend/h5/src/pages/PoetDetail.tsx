import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPoetPoems } from '../api'
import type { Poem } from '../types'

interface PoetInfo {
  name: string; dynasty: string; tags: string[]; description: string
}
interface TrajectoryEvent {
  event_year: string; ancient_place: string | null
  wgs84_lat: number | null; wgs84_lon: number | null; event_type: string
  stay_duration_days?: number | null; source?: string | null
}

export default function PoetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poet, setPoet] = useState<PoetInfo | null>(null)
  const [poems, setPoems] = useState<Poem[]>([])
  const [trajectory, setTrajectory] = useState<TrajectoryEvent[]>([])

  useEffect(() => {
    if (!id) return
    // 并行获取诗人信息、作品、轨迹
    Promise.all([
      fetch(`/api/v1/poets/${id}/detail`).then(r => r.json()).catch(() => null),
      getPoetPoems(id).catch(() => [] as Poem[]),
      fetch(`/api/v1/poets/${id}/trajectory`).then(r => r.json()).then(d => d.events || []).catch(() => []),
    ]).then(([poetData, poemsData, trajData]) => {
      if (poetData && poetData.name) {
        setPoet({ name: poetData.name, dynasty: poetData.dynasty, tags: poetData.tags || [], description: poetData.description || '' })
      } else {
        // 如果 detail 端点失败，尝试从列表获取
        fetch('/api/v1/poets?limit=200').then(r => r.json()).then(d => {
          const p = (d.poets || []).find((p: any) => p.poet_id === id)
          if (p) setPoet({ name: p.name, dynasty: p.dynasty, tags: p.tags || [], description: '' })
        }).catch(() => {})
      }
      setPoems(poemsData)
      setTrajectory(trajData)
    })
  }, [id])

  // 事件颜色映射（与 PC 版 eventColor 一致）
  const eventColor = (type: string): string => {
    if (['出生','去世'].includes(type)) return '#2196F3'
    if (type === '科举') return '#00BCD4'
    if (['仕宦','政治'].includes(type)) return '#1565C0'
    if (type === '贬谪') return '#F44336'
    if (['游览','交游'].includes(type)) return '#4CAF50'
    if (type === '雅集') return '#FFD700'
    if (type === '军事') return '#FF5722'
    if (type === '隐居') return '#795548'
    if (type === '创作') return '#9C27B0'
    return '#999'
  }

  const formatDuration = (days: number | null | undefined): string => {
    if (!days) return ''
    if (days >= 365) return `（${Math.round(days/365)}年）`
    if (days >= 30) return `（${Math.round(days/30)}月）`
    return `（${days}天）`
  }

  // Haversine 距离计算
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  const validTraj = trajectory.filter(t => t.event_year)
  // 按年份排序
  const sortedTraj = [...validTraj].sort((a, b) => (a.event_year || '').localeCompare(b.event_year || ''))
  // 足迹城市（去重保留顺序）
  const seen = new Set<string>()
  const cities = sortedTraj.filter(t => {
    if (!t.ancient_place || seen.has(t.ancient_place)) return false
    seen.add(t.ancient_place)
    return true
  }).map(t => t.ancient_place!)

  if (!poet) return (
    <div className="p-8 text-center">
      <div className="inline-block w-6 h-6 border-2 border-[#c23a3a] border-t-transparent rounded-full animate-spin mb-2" />
      <p className="text-gray-400 text-sm">诗人信息加载中…</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-none h-44 bg-gradient-to-b from-[#2c2c2c]/5 via-[#7a8b8b]/15 to-[#f5f0e8] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 375 176">
            <path d="M0 140 Q60 55 120 100 Q180 140 240 65 Q300 0 375 45 L375 176 L0 176 Z" fill="#2c2c2c" />
            <path d="M0 158 Q80 110 160 133 Q240 158 320 105 L375 120 L375 176 L0 176 Z" fill="#2c2c2c" opacity="0.5" />
          </svg>
        </div>
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-10 w-8 h-8 bg-white/70 rounded-full flex items-center justify-center text-gray-600 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <div className="relative -mt-14 z-10 flex flex-col items-center px-6">
        <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-amber-50 to-amber-100 mb-3 flex items-center justify-center text-2xl font-bold text-[#5B4A3E]">
          {poet.name[0]}
        </div>
        <h2 className="text-2xl font-black text-[#c23a3a]">{poet.name}</h2>
        <p className="text-sm text-gray-500 mt-0.5 tracking-wider">{poet.dynasty}</p>
        {poet.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {poet.tags.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] border border-[#c23a3a] text-[#c23a3a] px-3 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
        {poet.description && (
          <p className="text-xs text-gray-500 mt-3 leading-relaxed text-center px-2">{poet.description.slice(0, 120)}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '存诗', value: poems.length, color: '#C23B22' },
            { label: '游历', value: cities.length, color: '#4A6670' },
            { label: '事件', value: validTraj.length, color: '#B8860B' },
          ].map((m, i) => (
            <div key={i} className="bg-white/50 border border-[#e5ddd0] p-3 text-center"
              style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
              <p className="text-xl font-black" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {sortedTraj.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[11px] font-bold text-[#5B4A3E] tracking-wider">生平履历</h3>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-gray-200 to-transparent" />
            </div>
            <div className="relative pl-6 border-l-2 border-gray-200 space-y-4">
              {sortedTraj.map((t, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                    style={{ background: eventColor(t.event_type) }} />
                  <p className="text-xs font-bold" style={{ color: i === 0 ? eventColor(t.event_type) : '#666' }}>
                    {t.event_year}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {t.ancient_place ? `${t.ancient_place} · ` : ''}{t.event_type}
                    {formatDuration(t.stay_duration_days)}
                  </p>
                  {t.source && <p className="text-[9px] text-gray-300 mt-0.5">{t.source}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {cities.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[11px] font-bold text-[#5B4A3E] tracking-wider">地域足迹</h3>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-gray-200 to-transparent" />
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {cities.map((city, i) => {
                // 找到该城市的出现位置，用于计算距离
                const firstEvent = sortedTraj.find(e => e.ancient_place === city)
                const prevEvent = i > 0 ? sortedTraj.find(e => e.ancient_place === cities[i-1]) : null
                let dist = ''
                if (prevEvent && firstEvent?.wgs84_lat && firstEvent?.wgs84_lon && prevEvent.wgs84_lat && prevEvent.wgs84_lon) {
                  const d = Math.round(haversine(prevEvent.wgs84_lat, prevEvent.wgs84_lon, firstEvent.wgs84_lat, firstEvent.wgs84_lon))
                  if (d > 0) dist = `${d}km`
                }
                return (
                  <div key={i} className="min-w-[95px] bg-white/50 border border-[#e5ddd0] p-2.5 flex flex-col items-center">
                    <svg className="w-5 h-5 mb-1 text-[#7a8b8b]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <p className="text-xs font-bold text-center text-[#5B4A3E]">{city}</p>
                    {dist && <p className="text-[8px] text-gray-300 mt-0.5">{dist}</p>}
                  </div>
                )}
              )}
            </div>
            <div className="mt-3 text-center">
              <button onClick={() => navigate(`/poet/${id}/map`)}
                className="text-[10px] text-[#C23B22] border border-[#C23B22] px-3 py-1 hover:bg-[#C23B22] hover:text-white transition-colors">
                📍 查看足迹地图
              </button>
            </div>
          </div>
        )}

        {poems.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-[#5B4A3E] tracking-wider">代表作</h3>
              <span onClick={() => navigate(`/poet/${id}/works`)}
                className="text-[10px] text-[#C23B22] cursor-pointer hover:underline">
                查看全部 {poems.length} 首 →
              </span>
            </div>
            <div className="space-y-2">
              {poems.slice(0, 5).map((p, i) => (
                <div key={i} className="bg-white/60 border border-[#e5ddd0] p-3 cursor-pointer hover:border-[#C23B22] transition-colors"
                  style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
                  onClick={() => navigate(`/detail/${p.poetry_id}`)}>
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="text-sm font-bold text-[#5B4A3E]">{p.title}</h4>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5">{p.genre}</span>
                  </div>
                  <p className="text-[11px] italic text-gray-500">{(p.content || '').slice(0, 28)}…</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {poems.length === 0 && validTraj.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
        )}
      </div>
    </div>
  )
}
