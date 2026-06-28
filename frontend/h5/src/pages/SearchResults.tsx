import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchAll } from '../api'

export default function SearchResults() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [results, setResults] = useState<any>(null)
  const [tab, setTab] = useState(0)

  const keyword = params.get('q') || ''
  const dynasty = params.get('dynasty') || ''

  useEffect(() => {
    if (keyword) searchAll(keyword).then(setResults).catch(() => {})
  }, [keyword])

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="font-bold text-sm">{keyword || dynasty}</div>
      </div>

      {/* Tab */}
      <div className="flex text-xs border-b border-gray-200">
        {['全部', '诗词', '诗人'].map((t, i) => (
          <button key={i}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 font-bold ${tab === i ? 'text-[#c23a3a] border-b-2 border-[#c23a3a]' : 'text-gray-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 结果 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(!tab || tab === 0) && results?.poems?.slice(0, 10).map((p: any, i: number) => (
          <div key={i} className="bg-white p-4 border border-gray-200 shadow-sm cursor-pointer"
            onClick={() => navigate(`/detail/${p.poetry_id}`)}>
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-bold text-sm">{p.title}</h4>
              <span className="text-[#b8860b] text-xs">☆ 9.4</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{p.author} · {p.dynasty}</p>
            <p className="text-xs italic text-gray-600 border-l-2 border-gray-200 pl-3 py-1 mb-2">
              {(p.content || '').slice(0, 30)}…
            </p>
            <div className="flex gap-2">
              {(p.mood_tags || []).slice(0, 2).map((t: string) => (
                <span key={t} className="text-[10px] bg-gray-100 px-2 py-0.5 text-gray-500">{t}</span>
              ))}
            </div>
          </div>
        ))}

        {tab === 1 && results?.poems?.slice(0, 10).map((p: any, i: number) => (
          <div key={i} className="bg-white p-4 border border-gray-200" onClick={() => navigate(`/detail/${p.poetry_id}`)}>
            <h4 className="font-bold text-sm">{p.title}</h4>
            <p className="text-xs text-gray-500">{p.author} · {p.dynasty}</p>
          </div>
        ))}

        {tab === 2 && results?.poets?.slice(0, 10).map((p: any, i: number) => (
          <div key={i} className="bg-white p-4 border border-gray-200 flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(`/poet/${p.poet_id}`)}>
            <div className="w-10 h-10 rounded-full bg-[#f5f0e8] border border-gray-300 flex items-center justify-center text-sm font-bold">
              {p.name[0]}
            </div>
            <div>
              <h4 className="font-bold text-sm">{p.name}</h4>
              <p className="text-xs text-gray-500">{p.dynasty}</p>
            </div>
          </div>
        ))}

        {!results && <div className="text-xs text-gray-400 text-center py-8">输入关键词开始搜索</div>}
      </div>
    </div>
  )
}
