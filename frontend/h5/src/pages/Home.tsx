import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDailyPoem } from '../api'
import type { DailyPoem } from '../types'
import Seal from '../components/Seal'

export default function Home() {
  const [poem, setPoem] = useState<DailyPoem | null>(null)
  const navigate = useNavigate()

  useEffect(() => { getDailyPoem().then(setPoem).catch(() => {}) }, [])

  return (
    <div className="px-6 pt-6 pb-4">
      {/* 顶部 */}
      <div className="text-center relative mb-4">
        <div className="absolute top-1 left-0 vertical-text text-[10px] text-gray-400 tracking-widest opacity-60"
          style={{ writingMode: 'vertical-rl' }}>
          丙申年 五月廿三
        </div>
        <h1 className="text-3xl font-black tracking-tighter mb-1"
          style={{ fontFamily: '"Noto Serif SC",serif' }}>
          诗词雅韵
        </h1>
        <p className="text-[10px] tracking-[0.4em] text-gray-400 uppercase">Shici Yayun</p>
        <div className="flex justify-center mt-3">
          <div className="h-[1px] w-24 bg-gray-300 relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-gray-300 bg-[#f5f0e8]" />
          </div>
        </div>
      </div>

      {/* 每日一诗卡片 */}
      {poem && (
        <div className="bg-white/40 p-1 border border-gray-200 shadow-sm mb-6">
          <div className="border border-gray-300 p-6 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-5 text-6xl text-gray-500">诗</div>
            <Seal text="今日荐" />
            <h2 className="text-2xl font-bold mt-3 mb-1" style={{ fontFamily: '"Noto Serif SC",serif' }}>
              {poem.title}
            </h2>
            <p className="text-gray-500 text-sm mb-4">{poem.author} · {poem.dynasty}</p>
            <div className="text-base leading-loose tracking-widest text-center mb-6 space-y-1">
              {poem.content.split(/[，。]/).filter(s => s.trim()).slice(0, 6).map((line, i) => (
                <p key={i}>{line}{i < 5 ? (i % 2 === 0 ? '，' : '。') : ''}</p>
              ))}
            </div>
            <button className="btn-primary" onClick={() => navigate(`/detail/${poem.poetry_id}`)}>
              开启研学
            </button>
            <div className="mt-4 flex gap-6 text-gray-400">
              <button className="hover:text-[#c23a3a] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
              <button className="hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 往期推荐占位 */}
      <div className="mb-4">
        <div className="flex justify-between items-end mb-3">
          <h3 className="font-bold border-l-4 border-[#c23a3a] pl-2 text-sm">往期推荐</h3>
          <span className="text-xs text-gray-400">更多 →</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {['将进酒', '声声慢', '琵琶行'].map((title, i) => (
            <div key={i} className="min-w-[130px] bg-white/50 p-3 border border-gray-200">
              <div className="w-full h-16 bg-gray-100 mb-2 flex items-center justify-center text-gray-300 text-xs">
                {['🏔️', '🌸', '📜'][i]}
              </div>
              <p className="text-xs font-bold">{title}</p>
              <p className="text-[10px] text-gray-400">
                {['李白', '李清照', '白居易'][i]} · {['唐', '宋', '唐'][i]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 底部装饰 */}
      <div className="py-4 opacity-20 text-center">
        <svg className="w-full h-12" viewBox="0 0 375 48" preserveAspectRatio="none">
          <path d="M0 40 Q60 10 120 25 Q180 40 240 15 Q300 0 375 20 L375 48 L0 48 Z" fill="#2c2c2c" />
          <path d="M0 44 Q80 30 160 38 Q240 44 320 32 L375 38 L375 48 L0 48 Z" fill="#2c2c2c" opacity="0.5" />
        </svg>
      </div>
    </div>
  )
}
