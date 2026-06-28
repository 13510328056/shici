import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listPoets, getPoetPoems } from '../api'
import type { Poet, Poem } from '../types'

export default function PoetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poet, setPoet] = useState<Poet | null>(null)
  const [poems, setPoems] = useState<Poem[]>([])

  useEffect(() => {
    if (!id) return
    listPoets().then(d => {
      const p = d.poets.find(p => p.poet_id === id)
      if (p) setPoet(p)
    }).catch(() => {})
    getPoetPoems(id).then(setPoems).catch(() => {})
  }, [id])

  if (!poet) return <div className="p-8 text-center text-gray-400 text-sm">加载中…</div>

  return (
    <div className="flex flex-col h-full">
      {/* 水墨山顶栏 */}
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

      {/* 诗人信息 */}
      <div className="relative -mt-16 z-10 flex flex-col items-center px-6">
        <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-[#f5f0e8] mb-3 flex items-center justify-center text-2xl font-bold text-[#5B4A3E]">
          {poet.name[0]}
        </div>
        <h2 className="text-2xl font-black text-[#c23a3a]" style={{ fontFamily: '"Noto Serif SC",serif' }}>
          {poet.name}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5 tracking-wider">{poet.dynasty}</p>
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {(poet.tags || []).slice(0, 3).map(t => (
            <span key={t} className="text-[10px] border border-[#c23a3a] text-[#c23a3a] px-3 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 三指标 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '存诗', value: poems.length },
            { label: '代表名篇', value: Math.min(poems.length, 20) },
            { label: '相关典故', value: Math.min(poems.length, 10) },
          ].map((m, i) => (
            <div key={i} className="bg-white/50 border border-gray-200 p-3 text-center">
              <p className="text-xl font-black text-[#c23a3a]">{m.value}+</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* 生平 */}
        {poet.description && (
          <div className="bg-white/40 p-4 border border-gray-200 mb-5">
            <p className="text-xs leading-relaxed text-gray-700 indent-4 tracking-wide">{poet.description.slice(0, 200)}</p>
          </div>
        )}

        {/* 代表作 */}
        {poems.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">代表作合辑</h3>
              <div className="flex gap-2 text-[10px]">
                <span className="text-[#c23a3a] font-bold border-b border-[#c23a3a]">最热</span>
              </div>
            </div>
            <div className="space-y-3">
              {poems.slice(0, 5).map((p, i) => (
                <div key={i} className="bg-white/50 border border-gray-200 p-3 cursor-pointer"
                  onClick={() => navigate(`/detail/${p.poetry_id}`)}>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-sm">{p.title}</h4>
                    <span className="text-[10px] text-[#b8860b]">☆ {(9.5 - i * 0.1).toFixed(1)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">{(p.content || '').slice(0, 20)}…</p>
                  <div className="flex gap-2 mt-2">
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
        <div className="border-t border-gray-200 bg-[#f5f0e8]/95 backdrop-blur-sm -mx-6 px-6 py-3 mt-4">
          <div className="flex items-center justify-around">
            <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-[#c23a3a] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <span className="text-[10px]">收藏诗人</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-blue-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              <span className="text-[10px]">分享</span>
            </button>
            <button className="bg-[#2c2c2c] text-[#f5f0e8] px-5 py-2 text-xs tracking-wider hover:bg-black transition-colors">
              查看更多作品
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
