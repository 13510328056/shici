import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPoetPoems, searchAll } from '../api'
import type { Poet, Poem } from '../types'

interface TrajectoryEvent {
  event_year: string
  ancient_place: string | null
  wgs84_lat: number | null
  wgs84_lon: number | null
  event_type: string
}

export default function PoetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poet, setPoet] = useState<Poet | null>(null)
  const [poems, setPoems] = useState<Poem[]>([])
  const [trajectory, setTrajectory] = useState<TrajectoryEvent[]>([])

  useEffect(() => {
    if (!id) return
    getPoetPoems(id).then(setPoems).catch(() => {})

    // Fetch trajectory
    fetch(`/api/v1/poets/${id}/trajectory`).then(r => r.json()).then(d => {
      setTrajectory(d.events || [])
    }).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id || !poems.length) return
    const author = poems[0].author
    searchAll(author).then(d => {
      const p = (d.poets || []).find((p: any) => p.name === author || p.poet_id === id)
      if (p) setPoet({ poet_id: p.poet_id, name: p.name, dynasty: p.dynasty, tags: p.tags || [] })
    }).catch(() => {})
  }, [id, poems])

  const validTraj = trajectory.filter(t => t.event_year)
  const cities = [...new Set(validTraj.map(t => t.ancient_place).filter(Boolean))]

  if (!poet) return (
    <div className="p-8 text-center">
      <div className="inline-block w-6 h-6 border-2 border-[#c23a3a] border-t-transparent rounded-full animate-spin mb-2" />
      <p className="text-gray-400 text-sm">加载中…</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* 山水顶栏 */}
      <div className="relative flex-none h-48 bg-gradient-to-b from-[#2c2c2c]/5 via-[#7a8b8b]/15 to-[#f5f0e8] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 375 192">
            <path d="M0 150 Q60 60 120 110 Q180 150 240 70 Q300 0 375 50 L375 192 L0 192 Z" fill="#2c2c2c" />
            <path d="M0 170 Q80 120 160 145 Q240 170 320 115 L375 130 L375 192 L0 192 Z" fill="#2c2c2c" opacity="0.5" />
          </svg>
        </div>
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-10 w-8 h-8 bg-white/70 rounded-full flex items-center justify-center text-gray-600 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* 头像信息 */}
      <div className="relative -mt-16 z-10 flex flex-col items-center px-6">
        <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-[#f5f0e8] mb-3 flex items-center justify-center text-2xl font-bold text-[#5B4A3E]">
          {poet.name[0]}
        </div>
        <h2 className="text-2xl font-black text-[#c23a3a]">{poet.name}</h2>
        <p className="text-sm text-gray-500 mt-0.5 tracking-wider">{poet.dynasty}</p>
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {(poet.tags || []).slice(0, 4).map(t => (
            <span key={t} className="text-[10px] border border-[#c23a3a] text-[#c23a3a] px-3 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      </div>

      {/* 内容滚动 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 三指标 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '存诗', value: poems.length },
            { label: '游历', value: cities.length },
            { label: '事件', value: validTraj.length },
          ].map((m, i) => (
            <div key={i} className="bg-white/50 border border-gray-200 p-3 text-center">
              <p className="text-xl font-black text-[#c23a3a]">{m.value}+</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* 生平时间线 */}
        {validTraj.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">生平履历</h3>
              <div className="flex-1 h-[1px] bg-gray-200" />
            </div>
            <div className="relative pl-6 border-l-2 border-gray-200 space-y-5">
              {validTraj.slice(0, 8).map((t, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-[25px] top-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    i === 0 ? 'bg-[#c23a3a]' : 'bg-gray-300'
                  }`} />
                  <p className={`text-xs font-bold ${i === 0 ? 'text-[#c23a3a]' : 'text-gray-600'}`}>{t.event_year}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.ancient_place || ''} {t.event_type}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 足迹 */}
        {cities.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">地域足迹</h3>
              <div className="flex-1 h-[1px] bg-gray-200" />
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {cities.slice(0, 10).map((city, i) => (
                <div key={i} className="min-w-[90px] bg-white/50 border border-gray-200 p-3 flex flex-col items-center">
                  <svg className="w-6 h-6 mb-1 text-[#7a8b8b]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <p className="text-xs font-bold text-center">{city}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 代表作 */}
        {poems.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">代表作合辑</h3>
              <span onClick={() => navigate(`/poet/${id}/works`)}
                className="text-[10px] text-[#c23a3a] cursor-pointer">查看全部 →</span>
            </div>
            <div className="space-y-3">
              {poems.slice(0, 5).map((p, i) => (
                <div key={i} className="bg-white/50 border border-gray-200 p-3 cursor-pointer hover:border-[#c23a3a]"
                  onClick={() => navigate(`/detail/${p.poetry_id}`)}>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-sm">{p.title}</h4>
                    <span className="text-[10px] text-[#b8860b]">☆ {(9.5 - i * 0.1).toFixed(1)}</span>
                  </div>
                  <p className="text-[10px] italic text-gray-400">{(p.content || '').slice(0, 24)}…</p>
                  <div className="flex gap-2 mt-1">
                    {(p.mood_tags || []).slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] bg-gray-100 px-2 py-0.5 text-gray-500">{t}</span>
                    ))}
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 ml-auto">{p.genre}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部操作栏 */}
        <div className="border-t border-gray-200 -mx-6 px-6 py-3 mt-2">
          <div className="flex items-center justify-around">
            <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-[#c23a3a] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <span className="text-[10px]">收藏</span>
            </button>
            <button onClick={() => navigate(`/poet/${id}/works`)}
              className="bg-[#2c2c2c] text-[#f5f0e8] px-5 py-2 text-xs tracking-wider hover:bg-black transition-colors">
              查看更多作品
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
