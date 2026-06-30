import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPoets, getPoetPoems } from '../api'
import type { Poet } from '../types'

const dynasties = ['唐', '宋', '魏晋', '先秦', '元', '明清']

// 精选诗单（按意境标签聚合）
const poetryCollections = [
  { title: '山水田园诗选', mood: '山水', icon: '🏔️', count: '24首' },
  { title: '边塞豪情佳作', mood: '边塞', icon: '⚔️', count: '18首' },
  { title: '思乡怀人名篇', mood: '思乡', icon: '🌙', count: '30首' },
  { title: '送别诗词精选', mood: '送别', icon: '🌿', count: '22首' },
]

export default function Discover() {
  const [query, setQuery] = useState('')
  const [poets, setPoets] = useState<Poet[]>([])
  const [poemCounts, setPoemCounts] = useState<Record<string, number>>({})
  const navigate = useNavigate()

  useEffect(() => {
    listPoets().then(async d => {
      const allPoets = d.poets
      // 取前 30 位并获取他们的作品数
      const top = allPoets.slice(0, 30)
      setPoets(top)

      // 异步获取每位诗人的作品数
      const counts: Record<string, number> = {}
      await Promise.all(top.slice(0, 15).map(async (p) => {
        try {
          const poems = await getPoetPoems(p.poet_id)
          counts[p.poet_id] = poems.length
        } catch { counts[p.poet_id] = 0 }
      }))
      setPoemCounts(counts)
    }).catch(() => {})
  }, [])

  // 按作品数排序取前 8
  const topPoets = [...poets].sort((a, b) => (poemCounts[b.poet_id] || 0) - (poemCounts[a.poet_id] || 0)).slice(0, 8)

  return (
    <div className="px-4 pt-4 pb-2">
      {/* 顶部标题 */}
      <div className="mb-4 flex items-center gap-2">
        <div className="w-1 h-4 bg-[#4A6670] rounded-full" />
        <h1 className="text-sm font-bold text-[#5B4A3E]" style={{ fontFamily: '"Noto Serif SC",serif' }}>发现</h1>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-5">
        <div className="border border-[#d4c5a9] bg-white/60" style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
          <input
            className="w-full bg-transparent py-2.5 pl-10 pr-4 text-sm focus:outline-none text-[#3a3a3a]"
            placeholder="搜索诗词、诗人、名句..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && query.trim() && navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
          />
          <svg className="absolute left-3 top-3 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query.trim() && (
            <button className="absolute right-2 top-2 px-3 py-1 text-xs text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #C23B22, #A12D16)' }}
              onClick={() => navigate(`/search?q=${encodeURIComponent(query.trim())}`)}>
              搜索
            </button>
          )}
        </div>
      </div>

      {/* 分类导航：朝代 */}
      <div className="mb-5">
        <h3 className="text-[11px] font-bold text-[#5B4A3E] mb-3 tracking-wider">按朝代</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {dynasties.map(d => (
            <span key={d}
              onClick={() => navigate(`/search?dynasty=${d}`)}
              className="px-4 py-1.5 bg-white/70 border border-[#e5ddd0] text-xs rounded-full whitespace-nowrap
                         cursor-pointer hover:border-[#C23B22] hover:text-[#C23B22] transition-colors text-[#5B4A3E]">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* 热门诗人 */}
      <div className="mb-5">
        <h3 className="text-[11px] font-bold text-[#5B4A3E] mb-3 tracking-wider">热门诗人</h3>
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-1">
          {topPoets.slice(0, 7).map(p => (
            <div key={p.poet_id}
              className="flex flex-col items-center min-w-[72px] cursor-pointer group"
              onClick={() => navigate(`/poet/${p.poet_id}`)}>
              <div className="w-14 h-14 rounded-full border-2 border-[#b8860b] p-0.5 mb-1.5
                            bg-gradient-to-br from-amber-50 to-amber-100
                            flex items-center justify-center text-base font-bold text-[#5B4A3E]
                            group-hover:border-[#C23B22] transition-colors shadow-sm">
                {p.name[0]}
              </div>
              <span className="text-[11px] font-bold text-[#5B4A3E] group-hover:text-[#C23B22] transition-colors">{p.name}</span>
              <span className="text-[9px] text-gray-400">{p.dynasty}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 飞花令快捷入口 */}
      <div className="mb-5">
        <div className="bg-gradient-to-r from-[#4A6670]/10 to-transparent border border-[#e5ddd0] p-3
                      cursor-pointer hover:border-[#C23B22] transition-colors flex items-center gap-3"
          style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
          onClick={() => navigate('/feihualing')}>
          <div className="w-10 h-10 rounded-full bg-[#4A6670]/20 flex items-center justify-center text-lg">🌸</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#5B4A3E]">飞花令 · 诗词接龙</p>
            <p className="text-[10px] text-gray-400">输入一个汉字，AI 返回含该字的诗句</p>
          </div>
          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>

      {/* 诗词分类 */}
      <div className="mb-5">
        <h3 className="text-[11px] font-bold text-[#5B4A3E] mb-3 tracking-wider">诗词分类</h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: '五言诗', sub: '五绝 · 五律', path: '五言', color: 'from-[#4A6670]/20 to-transparent', border: 'border-[#4A6670]/30' },
            { label: '七言诗', sub: '七绝 · 七律', path: '七言', color: 'from-[#C23B22]/10 to-transparent', border: 'border-[#C23B22]/20' },
            { label: '词 · 长短句', sub: '婉约 · 豪放', path: '词', color: 'from-[#B8860B]/10 to-transparent', border: 'border-[#B8860B]/20' },
          ].map((item, i) => (
            <div key={i}
              className={`flex-1 min-w-[100px] bg-gradient-to-br ${item.color} border ${item.border} p-3
                          cursor-pointer hover:border-[#C23B22] transition-colors`}
              style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
              onClick={() => navigate(`/genre/${item.path}`)}>
              <p className="text-sm font-bold text-[#5B4A3E]">{item.label}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 精选诗单 */}
      <div className="mb-4">
        <h3 className="text-[11px] font-bold text-[#5B4A3E] mb-3 tracking-wider">意境诗单</h3>
        <div className="space-y-2">
          {poetryCollections.map((item, i) => (
            <div key={i}
              className="bg-white/60 border border-[#e5ddd0] p-3 flex items-center gap-3
                         cursor-pointer hover:border-[#C23B22] transition-colors"
              style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
              onClick={() => navigate(`/search?mood=${item.mood}`)}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg border border-gray-200">
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#5B4A3E]">{item.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.count} · 意境标签：{item.mood}</p>
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
