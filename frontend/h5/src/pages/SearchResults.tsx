import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchUnified } from '../api'
import type { Poet, SearchPoem } from '../types'

/* ─── 匹配标签色 ───────────────────────────────────── */

const REASON_COLORS: Record<string, string> = {
  title:   'bg-red-100 text-red-700',
  author:  'bg-blue-100 text-blue-700',
  content: 'bg-green-100 text-green-700',
  mood:    'bg-amber-100 text-amber-700',
  imagery: 'bg-purple-100 text-purple-700',
  season:  'bg-cyan-100 text-cyan-700',
  festival:'bg-pink-100 text-pink-700',
  character:'bg-indigo-100 text-indigo-700',
}

/* ─── 主页 ──────────────────────────────────────────── */

export default function SearchResults() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const keyword = params.get('q') || ''
  const dynasty = params.get('dynasty') || ''
  const genre = params.get('genre') || ''
  const mood = params.get('mood') || ''

  const [data, setData] = useState<{ poets: Poet[]; poems: SearchPoem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(0)

  const hasFilters = !!(keyword || dynasty || genre || mood)

  // ── 统一搜索 —— 所有参数合并为一次 API 请求 ──
  useEffect(() => {
    if (!hasFilters) { setData(null); return }
    setLoading(true)
    searchUnified({
      keyword: keyword || undefined,
      dynasty: dynasty || undefined,
      genre: genre || undefined,
      mood_tag: mood || undefined,
      page_size: 30,
    })
      .then(d => setData(d))
      .catch(() => setData({ poets: [], poems: [], total: 0 }))
      .finally(() => setLoading(false))
  }, [keyword, dynasty, genre, mood])

  // ── 按相关性排序的诗词 ──
  const sortedPoems = useMemo(() => {
    if (!data?.poems) return []
    return [...data.poems].sort((a, b) => (b.relevance?.score ?? 0) - (a.relevance?.score ?? 0))
  }, [data?.poems])

  // 最佳匹配：score >= 60（标题、作者、内容级别匹配）
  const topMatches = useMemo(() => sortedPoems.filter(p => (p.relevance?.score ?? 0) >= 60), [sortedPoems])
  const otherMatches = useMemo(() => sortedPoems.filter(p => (p.relevance?.score ?? 0) < 60), [sortedPoems])

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="px-4 py-3 border-b border-[#e5ddd0] flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-[#C23B22] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="font-bold text-sm text-[#5B4A3E]">
          {dynasty && `${dynasty}`}
          {genre && `体裁：${genre}`}
          {mood && `意境：${mood}`}
          {keyword && `"${keyword}"`}
        </div>
      </div>

      {/* 筛选标签条 */}
      {(dynasty || genre || mood) && (
        <div className="flex gap-1.5 px-4 py-2 flex-wrap border-b border-[#ede8e0] bg-white/30">
          {dynasty && <FilterBadge label={`朝代: ${dynasty}`} />}
          {genre && <FilterBadge label={`体裁: ${genre}`} />}
          {mood && <FilterBadge label={`意境: ${mood}`} />}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#C23B22] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400">搜索中…</p>
          </div>
        </div>
      )}

      {/* 无结果 */}
      {!loading && data && sortedPoems.length === 0 && (data.poets?.length || 0) === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <span className="text-3xl mb-3">🔍</span>
          <p className="text-sm text-gray-400 mb-1">未找到相关结果</p>
          <p className="text-[11px] text-gray-300">试试其他关键词或筛选条件</p>
        </div>
      )}

      {/* 有结果 */}
      {!loading && data && (sortedPoems.length > 0 || (data.poets?.length || 0) > 0) && (
        <>
          {/* 结果 Tab 切换 */}
          <div className="flex text-xs border-b border-gray-200 flex-none bg-white/40">
            {['全部', '诗词', '诗人'].map((t, i) => (
              <button key={i}
                onClick={() => setTab(i)}
                className={`flex-1 py-2.5 font-bold tracking-wider transition-colors ${
                  tab === i ? 'text-[#C23B22] border-b-2 border-[#C23B22]' : 'text-gray-400 hover:text-[#5B4A3E]'
                }`}
              >
                {t}{i === 2 && data.poets?.length ? ` (${data.poets.length})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* 全部 Tab */}
            {tab === 0 && (
              <>
                {/* 诗人结果（置顶） */}
                {data.poets?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-gray-400 mb-2 tracking-wider">诗人</p>
                    {data.poets.slice(0, 3).map((p, i) => (
                      <PoetCard key={p.poet_id || i} poet={p} onClick={() => navigate(`/poet/${p.poet_id}`)} />
                    ))}
                  </div>
                )}

                {/* 最佳匹配（score >= 60） */}
                {topMatches.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-gray-400 mb-2 tracking-wider">最佳匹配</p>
                    {topMatches.slice(0, 3).map((p, i) => (
                      <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navigate(`/detail/${p.poetry_id}`)} />
                    ))}
                  </div>
                )}

                {/* 更多结果 */}
                {otherMatches.length > 0 && (
                  <div>
                    {topMatches.length > 0 && <p className="text-[10px] text-gray-400 mb-2 tracking-wider">更多结果</p>}
                    {otherMatches.slice(0, 20).map((p, i) => (
                      <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navigate(`/detail/${p.poetry_id}`)} compact />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 诗词 Tab */}
            {tab === 1 && sortedPoems.map((p, i) => (
              <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navigate(`/detail/${p.poetry_id}`)} />
            ))}

            {/* 诗人 Tab */}
            {tab === 2 && data.poets?.map((p, i) => (
              <PoetCard key={p.poet_id || i} poet={p} onClick={() => navigate(`/poet/${p.poet_id}`)} />
            ))}
          </div>
        </>
      )}

      {/* 空输入 */}
      {!hasFilters && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-300">输入关键词搜索诗词</p>
        </div>
      )}
    </div>
  )
}

/* ─── 子组件 ────────────────────────────────────────── */

function FilterBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] bg-[#C23B22]/10 text-[#C23B22] px-2 py-0.5 rounded-full border border-[#C23B22]/20">
      {label}
    </span>
  )
}

function PoetCard({ poet, onClick }: { poet: Poet; onClick: () => void }) {
  return (
    <div className="bg-white/60 border border-[#e5ddd0] p-3 flex items-center gap-3 cursor-pointer
                    hover:border-[#C23B22] transition-colors"
      style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
      onClick={onClick}>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-[#b8860b]
                      flex items-center justify-center text-sm font-bold text-[#5B4A3E] shrink-0">
        {poet.name?.[0] || '?'}
      </div>
      <div>
        <p className="text-sm font-bold text-[#5B4A3E]">{poet.name}</p>
        <p className="text-[10px] text-gray-400">{poet.dynasty}</p>
      </div>
    </div>
  )
}

function PoemCard({ poem, onClick, compact }: { poem: SearchPoem; onClick: () => void; compact?: boolean }) {
  const rel = poem.relevance
  const reasons = rel?.reasons || []
  return (
    <div className="bg-white/60 border border-[#e5ddd0] p-3 cursor-pointer hover:border-[#C23B22] transition-colors"
      style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
      onClick={onClick}>
      {/* 标题行 */}
      <div className="flex items-start justify-between mb-1">
        <h4 className={`font-bold text-[#5B4A3E] ${compact ? 'text-sm' : 'text-sm'}`}>{poem.title}</h4>
        {poem.genre && (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 shrink-0 ml-2">{poem.genre}</span>
        )}
      </div>

      {/* 作者·朝代 */}
      <p className="text-[11px] text-gray-500 mb-1">{poem.author} · {poem.dynasty}</p>

      {/* 正文摘要 */}
      {!compact && (
        <p className="text-[11px] italic text-gray-600 border-l-2 border-gray-200 pl-3 py-1 mb-1.5 leading-relaxed">
          {(poem.content || '').slice(0, 40)}…
        </p>
      )}

      {/* 匹配原因标签 */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {reasons.map((r, i) => (
            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full ${REASON_COLORS[r.field] || 'bg-gray-100 text-gray-600'}`}>
              {r.label}
            </span>
          ))}
        </div>
      )}

      {/* 意境标签 */}
      {!compact && (poem.mood_tags || []).length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {(poem.mood_tags || []).slice(0, 3).map((t: string) => (
            <span key={t} className="text-[9px] bg-gray-100 px-1.5 py-0.5 text-gray-500">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}
