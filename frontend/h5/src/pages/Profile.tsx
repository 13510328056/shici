import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Profile() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ poems: 0, poets: 0, places: 0 })

  useEffect(() => {
    fetch('/api/v1/export/stats').then(r => r.json()).then(d => {
      const c = d.counts || {}
      setStats({ poems: c.poetry || 0, poets: c.poets || 0, places: c.places || 0 })
    }).catch(() => {})
  }, [])

  const [favorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('h5_favorites') || '[]').length } catch { return 0 }
  })

  const [checkins] = useState(() => {
    try { return JSON.parse(localStorage.getItem('poetry_checkins') || '[]').length } catch { return 0 }
  })

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="relative flex-none h-36 bg-gradient-to-b from-[#2c2c2c]/5 via-[#7a8b8b]/15 to-[#f5f0e8] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 375 144">
            <path d="M0 110 Q60 40 120 70 Q180 110 240 50 Q300 0 375 40 L375 144 L0 144 Z" fill="#2c2c2c" />
          </svg>
        </div>
      </div>

      <div className="relative -mt-12 z-10 flex flex-col items-center px-6">
        <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg bg-[#f5f0e8] flex items-center justify-center text-2xl font-bold text-[#5B4A3E] mb-2">
          诗
        </div>
        <h2 className="text-lg font-bold text-[#5B4A3E]">诗词雅韵</h2>
        <p className="text-[10px] text-gray-400 tracking-wider">PoetrySpace · 学而时习之</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 数据统计 */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: '诗人', value: stats.poets, color: '#4A6670' },
            { label: '诗词', value: stats.poems, color: '#C23B22' },
            { label: '收藏', value: favorites, color: '#B8860B' },
            { label: '打卡', value: checkins, color: '#5B8C5A' },
          ].map((s, i) => (
            <div key={i} className="bg-white/50 border border-[#e5ddd0] p-2 text-center">
              <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 功能列表 */}
        <div className="space-y-2">
          {[
            { label: '我的收藏', icon: '❤️', desc: '收藏的诗词和诗人', onClick: () => navigate('/favorites') },
            { label: '打卡记录', icon: '📍', desc: '文旅景点打卡', onClick: () => navigate('/feihualing') },
            { label: '浏览历史', icon: '📖', desc: '最近看过的诗词', onClick: () => navigate('/favorites') },
            { label: '诗词统计', icon: '📊', desc: '平台数据概览', onClick: () => navigate('/discover') },
          ].map((item, i) => (
            <div key={i}
              className="bg-white/50 border border-[#e5ddd0] p-3 flex items-center gap-3 cursor-pointer
                         hover:border-[#C23B22] transition-colors"
              onClick={item.onClick}>
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#5B4A3E]">{item.label}</p>
                <p className="text-[10px] text-gray-400">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
