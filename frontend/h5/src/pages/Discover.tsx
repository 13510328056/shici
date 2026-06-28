import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPoets } from '../api'
import type { Poet } from '../types'

const dynasties = ['唐', '宋', '魏晋', '先秦', '元', '明清']

export default function Discover() {
  const [query, setQuery] = useState('')
  const [poets, setPoets] = useState<Poet[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    listPoets().then(d => setPoets(d.poets.slice(0, 20))).catch(() => {})
  }, [])

  return (
    <div className="px-4 pt-4 pb-2">
      {/* 搜索栏 */}
      <div className="relative mb-5">
        <input
          className="w-full bg-white/60 border border-gray-300 py-2.5 px-10 text-sm focus:outline-none focus:border-[#c23a3a]"
          placeholder="搜索诗词、诗人、名句..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && query.trim() && navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
        />
        <svg className="absolute left-3 top-3 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {query.trim() && (
          <button
            className="absolute right-3 top-2.5 text-[#c23a3a] text-xs font-bold"
            onClick={() => navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
          >
            搜索
          </button>
        )}
      </div>

      {/* 朝代分类 */}
      <div className="mb-5">
        <h3 className="text-xs font-bold text-gray-400 mb-3 tracking-widest uppercase">按朝代</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {dynasties.map(d => (
            <span key={d}
              onClick={() => navigate(`/search?dynasty=${d}`)}
              className="px-4 py-1 bg-white border border-gray-200 text-xs rounded-full whitespace-nowrap cursor-pointer hover:border-[#c23a3a] transition-colors"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* 热门诗人 */}
      <div className="mb-5">
        <h3 className="text-xs font-bold text-gray-400 mb-3 tracking-widest uppercase">热门诗人</h3>
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-1">
          {poets.slice(0, 8).map(p => (
            <div key={p.poet_id}
              className="flex flex-col items-center min-w-[70px] cursor-pointer"
              onClick={() => navigate(`/poet/${p.poet_id}`)}
            >
              <div className="w-14 h-14 rounded-full border-2 border-[#b8860b] p-0.5 mb-1.5 bg-[#f5f0e8] flex items-center justify-center text-lg">
                {p.name[0]}
              </div>
              <span className="text-xs font-bold">{p.name}</span>
              <span className="text-[10px] text-gray-400">{p.dynasty}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 精选诗单 */}
      <div className="mb-4">
        <h3 className="text-xs font-bold text-gray-400 mb-3 tracking-widest uppercase">精选诗单</h3>
        <div className="space-y-3">
          {[
            { title: '送别友人的十首佳作', sub: '长亭送别、送元二使安西等', count: '10首', icon: '📜', color: 'bg-[#7a8b8b]/20' },
            { title: '宋词里的婉约春天', sub: '蝶恋花、浣溪沙等', count: '12首', icon: '🌸', color: 'bg-[#c23a3a]/10' },
          ].map((item, i) => (
            <div key={i} className="bg-white/60 p-3 border border-gray-200 flex items-center gap-4 cursor-pointer hover:border-[#c23a3a] transition-colors">
              <div className={`w-14 h-14 ${item.color} flex items-center justify-center text-xl`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold">{item.title}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <div className="text-[10px] text-gray-400">{item.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
