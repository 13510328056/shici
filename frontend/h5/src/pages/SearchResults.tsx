import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchUnified } from '../api'
import type { Poet, SearchPoem } from '../types'

/* ─── 匹配标签色 ───────────────────────────────────── */

const REASON_COLORS: Record<string, string> = {
  title:    'bg-red-100 text-red-700',
  author:   'bg-blue-100 text-blue-700',
  content:  'bg-green-100 text-green-700',
  mood:     'bg-amber-100 text-amber-700',
  imagery:  'bg-purple-100 text-purple-700',
  season:   'bg-cyan-100 text-cyan-700',
  festival: 'bg-pink-100 text-pink-700',
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

  // ── 判断搜索模式 ──
  const isAuthorSearch = useMemo(() => {
    // 有诗人结果，且 top 诗词匹配原因含 author
    if (!data?.poets?.length || !sortedPoems.length) return false
    const topReasons = sortedPoems[0]?.relevance?.reasons || []
    return topReasons.some(r => r.field === 'author')
  }, [data, sortedPoems])

  // 默认 Tab：作者搜索 → 诗人栏，内容搜索 → 全部
  const defaultTab = isAuthorSearch ? 2 : 0
  const [tab, setTab] = useState(defaultTab)

  // 当搜索条件变化时重置 tab
  useEffect(() => { setTab(defaultTab) }, [defaultTab])

  // ── 作者搜索：该诗人的代表作 ──
  const authorPoems = useMemo(() => {
    if (!isAuthorSearch || !data?.poets?.length) return []
    const poetName = data.poets[0].name
    return sortedPoems.filter(p => p.author === poetName).slice(0, 5)
  }, [isAuthorSearch, data, sortedPoems])

  // ── 内容搜索：从诗词结果中提取相关诗人 ──
  const contentPoets = useMemo(() => {
    if (!data?.poets?.length && sortedPoems.length > 0) {
      // API 未返回诗人 → 从诗词结果提取（按相关性排序去重）
      const seen = new Set<string>()
      return sortedPoems
        .filter(p => {
          if (!p.author || seen.has(p.author)) return false
          seen.add(p.author)
          return true
        })
        .slice(0, 10)
        .map(p => ({
          name: p.author,
          poet_id: p.author_id || '',
          dynasty: p.dynasty,
        } as Poet))
    }
    return data?.poets || []
  }, [data, sortedPoems])

  // ── 子组件通用函数 ──
  const navPoet = (id: string) => id && navigate(`/poet/${id}`)
  const navDetail = (id: string) => id && navigate(`/detail/${id}`)

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

      {/* 加载 */}
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

      {/* ── 有结果 ── */}
      {!loading && data && (sortedPoems.length > 0 || contentPoets.length > 0) && (
        <>
          {/* Tab 导航 */}
          <div className="flex text-xs border-b border-gray-200 flex-none bg-white/40">
            {['全部', '诗词', '诗人'].map((t, i) => {
              const isActive = tab === i
              return (
                <button key={i}
                  onClick={() => setTab(i)}
                  className={`flex-1 py-2.5 font-bold tracking-wider transition-colors relative ${
                    isActive
                      ? 'text-[#C23B22]'
                      : 'text-gray-400 hover:text-[#5B4A3E]'
                  }`}
                >
                  {t}
                  {i === 2 && contentPoets.length > 0 && (
                    <span className="text-[9px] ml-0.5">({contentPoets.length})</span>
                  )}
                  {isActive && <span className="absolute bottom-0 left-[20%] right-[20%] h-[2px] bg-[#C23B22] rounded-full" />}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* ═══ 全部 ═══ */}
            {tab === 0 && (
              isAuthorSearch && data!.poets!.length > 0 ? (
                <>
                  {/* 作者搜索：大诗人卡片 + 代表作 */}
                  <div className="bg-white/60 border border-[#e5ddd0] p-4 text-center mb-2"
                    style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-[#b8860b]
                                    flex items-center justify-center text-xl font-bold text-[#5B4A3E] mx-auto mb-2 cursor-pointer
                                    hover:border-[#C23B22] transition-colors"
                      onClick={() => navPoet(data!.poets![0].poet_id)}>
                      {data!.poets![0].name[0]}
                    </div>
                    <h2 className="text-lg font-black text-[#C23B22] cursor-pointer hover:underline"
                      onClick={() => navPoet(data!.poets![0].poet_id)}>
                      {data!.poets![0].name}
                    </h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">{data!.poets![0].dynasty}</p>
                    {data!.poets![0].tags?.length > 0 && (
                      <div className="flex gap-1.5 justify-center mt-2">
                        {(data!.poets![0].tags || []).slice(0, 3).map((t: string) => (
                          <span key={t} className="text-[9px] border border-[#C23B22]/30 text-[#C23B22] px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {authorPoems.length > 0 && (
                    <>
                      <p className="text-[10px] text-gray-400 mb-1 tracking-wider">代表作</p>
                      {authorPoems.map((p, i) => (
                        <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navDetail(p.poetry_id)} />
                      ))}
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* 内容搜索：最佳匹配诗词置顶 */}
                  {sortedPoems.slice(0, 10).map((p, i) => (
                    <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navDetail(p.poetry_id)} />
                  ))}
                </>
              )
            )}

            {/* ═══ 诗词 ═══ */}
            {tab === 1 && (
              isAuthorSearch && data!.poets!.length > 0
                ? /* 作者搜索 → 仅显示该作者的诗 */
                  authorPoems.length > 0
                    ? authorPoems.map((p, i) => (
                        <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navDetail(p.poetry_id)} />
                      ))
                    : <p className="text-xs text-gray-400 text-center py-8">暂无该作者诗词数据</p>
                : /* 内容搜索 → 全部相关诗词 */
                  sortedPoems.map((p, i) => (
                    <PoemCard key={p.poetry_id || i} poem={p} onClick={() => navDetail(p.poetry_id)} />
                  ))
            )}

            {/* ═══ 诗人 ═══ */}
            {tab === 2 && (
              contentPoets.length > 0
                ? contentPoets.map((p, i) => (
                    <PoetCard key={p.poet_id || i} poet={p}
                      onClick={() => p.poet_id && navPoet(p.poet_id)} />
                  ))
                : <p className="text-xs text-gray-400 text-center py-8">无相关诗人</p>
            )}
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

function PoemCard({ poem, onClick }: { poem: SearchPoem; onClick: () => void }) {
  const rel = poem.relevance
  const reasons = rel?.reasons || []
  return (
    <div className="bg-white/60 border border-[#e5ddd0] p-3 cursor-pointer hover:border-[#C23B22] transition-colors"
      style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
      onClick={onClick}>
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-bold text-sm text-[#5B4A3E]">{poem.title}</h4>
        {poem.genre && (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 shrink-0 ml-2">{poem.genre}</span>
        )}
      </div>

      <p className="text-[11px] text-gray-500 mb-1">{poem.author} · {poem.dynasty}</p>

      <p className="text-[11px] italic text-gray-600 border-l-2 border-gray-200 pl-3 py-1 mb-1.5 leading-relaxed">
        {(poem.content || '').slice(0, 40)}…
      </p>

      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {reasons.map((r, i) => (
            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full ${REASON_COLORS[r.field] || 'bg-gray-100 text-gray-600'}`}>
              {r.label}
            </span>
          ))}
        </div>
      )}

      {(poem.mood_tags || []).length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {(poem.mood_tags || []).slice(0, 3).map((t: string) => (
            <span key={t} className="text-[9px] bg-gray-100 px-1.5 py-0.5 text-gray-500">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}
