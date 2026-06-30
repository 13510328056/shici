import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchAll, listPoets, searchByGenre } from '../api'
import type { Poet } from '../types'

export default function SearchResults() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [results, setResults] = useState<any>(null)
  const [dynastyPoets, setDynastyPoets] = useState<Poet[]>([])
  const [tab, setTab] = useState(0)

  const keyword = params.get('q') || ''
  const dynasty = params.get('dynasty') || ''
  const genre = params.get('genre') || ''
  const mood = params.get('mood') || ''

  // 关键词搜索
  useEffect(() => {
    if (keyword) {
      searchAll(keyword).then(setResults).catch(() => {})
    } else {
      setResults(null)
    }
  }, [keyword])

  // 朝代筛选
  useEffect(() => {
    if (dynasty) {
      listPoets(dynasty).then(d => setDynastyPoets(d.poets.slice(0, 30))).catch(() => {})
    } else {
      setDynastyPoets([])
    }
  }, [dynasty])

  // 体裁/意境筛选
  useEffect(() => {
    if (genre || mood) {
      searchByGenre(genre || mood || '诗', 30).then(setResults).catch(() => {})
    }
  }, [genre, mood])

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="px-4 py-3 border-b border-[#e5ddd0] flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="font-bold text-sm text-[#5B4A3E]">
          {dynasty && `${dynasty}代诗人`}
          {genre && `体裁：${genre}`}
          {mood && `意境：${mood}`}
          {keyword && `"${keyword}"`}
        </div>
      </div>

      {/* 朝代/体裁/意境 → 展示诗人或诗词 */}
      {(dynasty || genre || mood) && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {dynasty && dynastyPoets.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">共 {dynastyPoets.length} 位诗人</p>
              {dynastyPoets.map((p, i) => (
                <div key={i}
                  className="bg-white border border-[#e5ddd0] p-3 flex items-center gap-3 cursor-pointer
                             hover:border-[#C23B22] transition-colors"
                  onClick={() => navigate(`/poet/${p.poet_id}`)}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-[#b8860b] flex items-center justify-center text-sm font-bold text-[#5B4A3E]">
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#5B4A3E]">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.dynasty}</p>
                  </div>
                </div>
              ))}
            </>
          )}
          {dynasty && dynastyPoets.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">暂无该朝代诗人数据</div>
          )}
          {(genre || mood) && results?.results?.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">共 {results.total || results.results.length} 首</p>
              {results.results.slice(0, 20).map((p: any, i: number) => (
                <div key={i}
                  className="bg-white p-4 border border-[#e5ddd0] cursor-pointer hover:border-[#C23B22] transition-colors"
                  style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
                  onClick={() => navigate(`/detail/${p.poetry_id}`)}>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-sm text-[#5B4A3E]">{p.title}</h4>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5">{p.genre}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-0.5">{p.author} · {p.dynasty}</p>
                  {(p.mood_tags || []).length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {(p.mood_tags || []).slice(0, 2).map((t: string) => (
                        <span key={t} className="text-[10px] bg-gray-100 px-1.5 py-0.5 text-gray-500">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {(genre || mood) && (!results?.results || results.results.length === 0) && (
            <div className="text-center py-8 text-sm text-gray-400">
              暂无{genre || mood}相关诗词数据
            </div>
          )}
        </div>
      )}

      {/* 关键词搜索结果 */}
      {keyword && (
        <>
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
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {(!tab || tab === 0) && results?.poems?.slice(0, 15).map((p: any, i: number) => (
              <div key={i} className="bg-white p-4 border border-[#e5ddd0] cursor-pointer hover:border-[#C23B22] transition-colors"
                onClick={() => navigate(`/detail/${p.poetry_id}`)}
                style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-sm text-[#5B4A3E]">{p.title}</h4>
                  <span className="text-[#b8860b] text-xs">☆ 9.4</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{p.author} · {p.dynasty}</p>
                <p className="text-xs italic text-gray-600 border-l-2 border-gray-200 pl-3 py-1 mb-1">
                  {(p.content || '').slice(0, 35)}…
                </p>
                <div className="flex gap-2">
                  {(p.mood_tags || []).slice(0, 2).map((t: string) => (
                    <span key={t} className="text-[10px] bg-gray-100 px-2 py-0.5 text-gray-500">{t}</span>
                  ))}
                </div>
              </div>
            ))}

            {tab === 1 && results?.poems?.slice(0, 15).map((p: any, i: number) => (
              <div key={i} className="bg-white p-4 border border-[#e5ddd0]" onClick={() => navigate(`/detail/${p.poetry_id}`)}>
                <h4 className="font-bold text-sm text-[#5B4A3E]">{p.title}</h4>
                <p className="text-xs text-gray-500">{p.author} · {p.dynasty}</p>
              </div>
            ))}

            {tab === 2 && results?.poets?.slice(0, 15).map((p: any, i: number) => (
              <div key={i} className="bg-white p-4 border border-[#e5ddd0] flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/poet/${p.poet_id}`)}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-[#b8860b] flex items-center justify-center text-sm font-bold text-[#5B4A3E]">
                  {p.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#5B4A3E]">{p.name}</h4>
                  <p className="text-xs text-gray-500">{p.dynasty}</p>
                </div>
              </div>
            ))}

            {!results && <div className="text-xs text-gray-400 text-center py-8">搜索中…</div>}
          </div>
        </>
      )}
    </div>
  )
}
