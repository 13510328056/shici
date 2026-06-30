import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDailyPoem, getRandomPoem } from '../api'
import type { DailyPoem, Poem } from '../types'
import Seal from '../components/Seal'

export default function Home() {
  const [poem, setPoem] = useState<DailyPoem | null>(null)
  const [recommend, setRecommend] = useState<Poem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    getDailyPoem().then(setPoem).catch(() => {})
    // 加载往期推荐（随机3首）
    Promise.all([getRandomPoem(), getRandomPoem(), getRandomPoem()]).then(setRecommend).catch(() => {})
  }, [])

  return (
    <div className="px-5 pt-5 pb-4">
      {/* 顶部标题 */}
      <div className="text-center relative mb-5">
        <div className="absolute top-1 left-0 text-[9px] text-gray-400 tracking-[0.3em] opacity-50"
          style={{ writingMode: 'vertical-rl', height: 60 }}>
          丙申年 · 五月廿三
        </div>
        <h1 className="text-2xl font-black tracking-[0.05em] mb-0.5 text-[#3a3a3a]"
          style={{ fontFamily: '"Noto Serif SC",serif' }}>
          诗词雅韵
        </h1>
        <p className="text-[9px] tracking-[0.5em] text-gray-400">PoetrySpace</p>
        <div className="flex justify-center mt-2">
          <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>
      </div>

      {/* 每日一诗卡片 */}
      {poem && (
        <div className="bg-white/50 border border-[#d4c5a9] shadow-sm mb-5" style={{ outline: '1px solid #ede8e0', outlineOffset: 2 }}>
          <div className="px-5 py-6 flex flex-col items-center relative">
            {/* 装饰纹路 */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#8B7355] via-[#C4B5A0] to-[#8B7355]" />

            <Seal text="今日荐" />

            {/* 意境标签 */}
            {(poem.mood_tags || []).length > 0 && (
              <div className="flex gap-2 mt-2">
                {(poem.mood_tags || []).slice(0, 3).map((t: string) => (
                  <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>
                ))}
              </div>
            )}

            <h2 className="text-xl font-bold mt-3 mb-0.5 text-[#5B4A3E]"
              style={{ fontFamily: '"Noto Serif SC",serif' }}>
              {poem.title}
            </h2>
            <p className="text-[11px] text-gray-400 tracking-wider mb-4">{poem.author} · {poem.dynasty}</p>

            {/* 诗词正文 */}
            <div className="text-sm leading-[2.4] tracking-[0.15em] text-center mb-5 text-[#3a3a3a] font-serif">
              {poem.content.split(/[，。]/).filter(s => s.trim()).slice(0, 6).map((line, i) => (
                <p key={i}>{line}{i < 5 ? (i % 2 === 0 ? '，' : '。') : ''}</p>
              ))}
            </div>

            {/* 按钮：朱红古典风格 */}
            <button
              onClick={() => navigate(`/detail/${poem.poetry_id}`)}
              className="px-8 py-2.5 text-sm tracking-[0.2em] transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #C23B22 0%, #A12D16 100%)',
                color: '#F5F0EA',
                border: '1px solid #8B2210',
                boxShadow: '0 2px 8px rgba(194,59,34,0.3)',
                fontFamily: '"Noto Serif SC",serif',
                letterSpacing: '0.2em',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(194,59,34,0.4)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(194,59,34,0.3)'}
            >
              开启研学
            </button>

            {/* 操作图标 */}
            <div className="mt-4 flex gap-8 text-gray-400">
              <button className="hover:text-[#C23B22] transition-colors" onClick={() => { try { const fav = JSON.parse(localStorage.getItem("h5_favorites") || "[]"); if (!fav.find((f:any) => f.id === poem.poetry_id)) { fav.unshift({id: poem.poetry_id, title: poem.title, author: poem.author, type: "poem", time: Date.now()}); localStorage.setItem("h5_favorites", JSON.stringify(fav)); } } catch(e) {} }} title="收藏">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
              <button className="hover:text-[#5B8C5A] transition-colors"
                onClick={() => { if (navigator.share) navigator.share({title: poem.title, text: poem.content.slice(0,80)}).catch(()=>{}) }}
                title="分享">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>
            </div>

            {/* 底部卷轴 */}
            <div className="mt-4 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          </div>
        </div>
      )}

      {/* 往期推荐 */}
      {recommend.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-xs font-bold text-[#5B4A3E] tracking-wider pl-2"
              style={{ borderLeft: '3px solid #C23B22' }}>随机推荐</h3>
            <span className="text-[10px] text-gray-400 cursor-pointer hover:text-[#C23B22] transition-colors"
              onClick={() => navigate("/discover")}>更多 →</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {recommend.slice(0, 3).map((item, i) => (
              <div key={i}
                className="min-w-[130px] bg-white/50 border border-[#e5ddd0] p-3 cursor-pointer
                           hover:border-[#C23B22] hover:shadow-sm transition-all duration-200"
                onClick={() => navigate(`/detail/${item.poetry_id}`)}>
                <div className="w-full h-[60px] bg-gradient-to-br from-gray-50 to-gray-100 mb-2 flex items-center justify-center text-xl opacity-70">
                  {['🏔️', '🌸', '📜'][i]}
                </div>
                <p className="text-xs font-bold text-[#5B4A3E]">{item.title}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{item.author} · {item.dynasty}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部装饰 — 水墨山 */}
      <div className="py-4 opacity-[0.08] text-center">
        <svg className="w-full h-10" viewBox="0 0 375 40" preserveAspectRatio="none">
          <path d="M0 35 Q60 8 120 20 Q180 35 240 12 Q300 0 375 18 L375 40 L0 40 Z" fill="#2c2c2c" />
          <path d="M0 38 Q80 25 160 32 Q240 38 320 26 L375 30 L375 40 L0 40 Z" fill="#2c2c2c" opacity="0.5" />
        </svg>
      </div>
    </div>
  )
}
