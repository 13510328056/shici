import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/* ─── 类型 ─────────────────────────────────────────── */

interface StatsData {
  overview: {
    total_poems: number; total_poets: number; total_places: number
    total_ci: number; total_qu: number
    poem_types: Record<string, number>
  }
  dynasties: Array<{ dynasty: string; poem_count: number; poet_count: number }>
  timeline: Array<{ year: string; count: number }>
  genres: Array<{ name: string; count: number }>
  top_cipai: Array<{ name: string; count: number }>
  top_qupai: Array<{ name: string; count: number }>
  top_poets: Array<{ name: string; dynasty: string; count: number }>
  imagery: Array<{ name: string; count: number }>
  moods: Array<{ name: string; count: number }>
  allusions: Array<{ name: string; count: number }>
  schools: Array<{ school: string; poet_count: number; poem_count: number }>
}

/* ─── 小组件 ────────────────────────────────────────── */

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="bg-white/60 border border-[#e5ddd0] p-3 text-center"
      style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-gray-300 mt-0.5">{sub}</p>}
    </div>
  )
}

function HBarChart({ data, color }: {
  data: Array<{ name: string; value: number }>
  color?: string
}) {
  if (!data.length) return <p className="text-[11px] text-gray-400 py-3 text-center">暂无数据</p>
  const m = Math.max(...data.map(d => d.value), 1)
  const palette = ['#C23B22','#4A6670','#B8860B','#5B8C5A','#8B5E3C','#6B4E71','#3A7B7B']
  return (
    <div className="space-y-1">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-[4.2em] text-right shrink-0 truncate">{d.name}</span>
          <div className="flex-1 relative h-[18px] bg-[#ede8e0] rounded-sm overflow-hidden">
            <div className="h-full rounded-sm flex items-center justify-end pr-1 transition-all duration-500"
              style={{
                width: `${Math.max((d.value / m) * 100, d.value > 0 ? 18 : 0)}%`,
                background: color ?? palette[i % 7],
              }}>
              <span className="text-[9px] text-white font-bold drop-shadow-sm">{d.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RankingList({ data }: { data: Array<{ name: string; count: number; subtitle?: string }> }) {
  if (!data.length) return <p className="text-[11px] text-gray-400 py-3 text-center">暂无数据</p>
  return (
    <div className="space-y-0.5">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2 py-1">
          <span className={`text-[10px] w-5 text-center font-bold shrink-0 ${
            i < 3 ? 'text-[#C23B22]' : 'text-gray-400'
          }`}>{i + 1}</span>
          <span className="text-[12px] text-[#5B4A3E] truncate">{d.name}</span>
          {d.subtitle && <span className="text-[9px] text-gray-400 shrink-0">{d.subtitle}</span>}
          <span className="text-[11px] text-gray-400 ml-auto shrink-0">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

function TypePie({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)
  const total = entries.reduce((s, [, v]) => s + v, 0)
  if (!total) return null
  const COLORS: Record<string, string> = { '诗': '#C23B22', '词': '#4A6670', '曲': '#B8860B', '赋': '#5B8C5A', '古文': '#8B5E3C' }
  return (
    <div className="space-y-2">
      <div className="flex h-5 rounded-sm overflow-hidden border border-[#e5ddd0]">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-center text-[8px] text-white font-bold"
            style={{
              width: `${(v / total) * 100}%`,
              background: COLORS[k] || '#999',
              minWidth: v / total * 100 > 8 ? undefined : 0,
            }}>
            {v / total * 100 >= 8 ? (k === '古文' ? '文' : k) : ''}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[k] || '#999' }} />
            <span className="text-[10px] text-gray-500">{k} <b className="text-[#5B4A3E]">{(v / total * 100).toFixed(1)}%</b></span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── 图表卡片容器 ──────────────────────────────────── */

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/40 border border-[#e5ddd0] p-3 ${className}`}
      style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
      <p className="text-[11px] font-bold text-[#5B4A3E] mb-2.5 flex items-center gap-1.5"
        style={{ fontFamily: '"Noto Serif SC",serif' }}>
        <span className="w-1 h-3 bg-[#C23B22] rounded-full inline-block" />
        {title}
      </p>
      {children}
    </div>
  )
}

/* ─── Tab 页 ────────────────────────────────────────── */

function TabOverview({ overview, dynasties, timeline, genres }: {
  overview: StatsData['overview']; dynasties: StatsData['dynasties']
  timeline: StatsData['timeline']; genres: StatsData['genres']
}) {
  const typeEntries = Object.entries(overview.poem_types).filter(([, v]) => v > 0)
  return (
    <div className="space-y-3">
      {typeEntries.length > 0 && <ChartCard title="篇目分类"><TypePie data={overview.poem_types} /></ChartCard>}
      {dynasties.length > 0 && (
        <ChartCard title="朝代排行（作品数）">
          <HBarChart data={dynasties.slice(0, 10).map(d => ({ name: d.dynasty, value: d.poem_count }))} color="#C23B22" />
        </ChartCard>
      )}
      {timeline.length > 0 && (
        <ChartCard title="历代趋势（按王朝时序）">
          <HBarChart data={timeline.map(d => ({ name: d.year, value: d.count }))} />
        </ChartCard>
      )}
      {genres.length > 0 && (
        <ChartCard title="体裁分布">
          <HBarChart data={genres.slice(0, 10).map(g => ({ name: g.name, value: g.count }))} color="#4A6670" />
        </ChartCard>
      )}
    </div>
  )
}

function TabText({ imagery, moods, allusions }: {
  imagery: StatsData['imagery']; moods: StatsData['moods']; allusions: StatsData['allusions']
}) {
  return (
    <div className="space-y-3">
      <ChartCard title="高频意象 TOP 20">
        <RankingList data={imagery.slice(0, 20).map(i => ({ name: i.name, count: i.count }))} />
      </ChartCard>
      <ChartCard title="情感主题分布">
        <HBarChart data={moods.slice(0, 10).map(m => ({ name: m.name, value: m.count }))} color="#B8860B" />
      </ChartCard>
      <ChartCard title="典故排行">
        <RankingList data={allusions.map(a => ({ name: a.name, count: a.count }))} />
      </ChartCard>
    </div>
  )
}

function TabPeople({ top_poets, top_cipai, top_qupai, schools }: {
  top_poets: StatsData['top_poets']; top_cipai: StatsData['top_cipai']
  top_qupai: StatsData['top_qupai']; schools: StatsData['schools']
}) {
  return (
    <div className="space-y-3">
      <ChartCard title="作者作品 TOP 20">
        <RankingList data={top_poets.slice(0, 20).map(p => ({ name: p.name, count: p.count, subtitle: p.dynasty }))} />
      </ChartCard>

      {top_cipai.length > 0 && (
        <ChartCard title="热门词牌 TOP">
          <RankingList data={top_cipai.map(c => ({ name: c.name, count: c.count }))} />
        </ChartCard>
      )}
      {top_qupai.length > 0 && (
        <ChartCard title="热门曲牌 TOP">
          <RankingList data={top_qupai.map(c => ({ name: c.name, count: c.count }))} />
        </ChartCard>
      )}

      {schools.filter(s => s.poet_count > 0).length > 0 && (
        <ChartCard title="流派与文人组合">
          <div className="grid grid-cols-2 gap-2">
            {schools.filter(s => s.poet_count > 0).map(s => (
              <div key={s.school}
                className="bg-white/70 border border-[#e5ddd0] p-2.5 text-center rounded-sm">
                <p className="text-[11px] font-bold text-[#5B4A3E] truncate">{s.school}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  <span className="text-[#C23B22] font-bold">{s.poet_count}</span> 人 · <span className="text-[#4A6670] font-bold">{s.poem_count}</span> 篇
                </p>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  )
}

/* ─── 加载 & 错误 ────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="px-4 pt-4 pb-6 animate-pulse">
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded mb-3" />)}
    </div>
  )
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-4xl mb-3">📊</span>
      <p className="text-sm text-gray-400 mb-4">{msg}</p>
      <button onClick={onRetry}
        className="px-6 py-2 text-xs text-white rounded-sm"
        style={{ background: 'linear-gradient(135deg, #C23B22, #A12D16)' }}>
        重新加载
      </button>
    </div>
  )
}

/* ─── 主页面 ────────────────────────────────────────── */

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'text', label: '文本' },
  { key: 'people', label: '人物' },
] as const
type TabKey = typeof TABS[number]['key']

export default function Stats() {
  const navigate = useNavigate()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')

  const load = () => {
    setLoading(true)
    setError('')
    fetch('/api/v1/stats')
      .then<StatsData>(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || '加载失败'); setLoading(false) })
  }

  useEffect(load, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState msg={error} onRetry={load} />
  if (!data) return null

  const { overview, dynasties, timeline, genres, top_cipai, top_qupai,
          top_poets, imagery, moods, allusions, schools } = data

  return (
    <div className="px-4 pt-3 pb-6">
      {/* ── 顶栏 ── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500 hover:text-[#C23B22] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-[#5B4A3E]" style={{ fontFamily: '"Noto Serif SC",serif' }}>
          诗词统计
        </h1>
      </div>

      {/* ── 概览卡片（固定） ── */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard label="全库诗词" value={overview.total_poems.toLocaleString()} color="#C23B22"
          sub="含诗、词、曲、赋、古文" />
        <StatCard label="收录作者" value={overview.total_poets.toLocaleString()} color="#4A6670" sub="历代文人墨客" />
        <StatCard label="创作地名" value={overview.total_places.toLocaleString()} color="#B8860B" sub="古今地名映射" />
        <StatCard label="词牌 / 曲牌" value={(overview.total_ci + overview.total_qu).toLocaleString()} color="#5B8C5A"
          sub={`词 ${overview.total_ci} · 曲 ${overview.total_qu}`} />
      </div>

      {/* ── Tab 导航 ── */}
      <div className="flex mb-3 border-b border-[#e5ddd0]">
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-bold tracking-wider transition-colors relative ${
              tab === t.key ? 'text-[#C23B22]' : 'text-gray-400 hover:text-[#5B4A3E]'
            }`}>
            {t.label}
            {tab === t.key && <span className="absolute bottom-0 left-[20%] right-[20%] h-[2px] bg-[#C23B22] rounded-full" />}
          </button>
        ))}
      </div>

      {/* ── Tab 内容 ── */}
      {tab === 'overview' && <TabOverview {...{ overview, dynasties, timeline, genres }} />}
      {tab === 'text' && <TabText {...{ imagery, moods, allusions }} />}
      {tab === 'people' && <TabPeople {...{ top_poets, top_cipai, top_qupai, schools }} />}

      {/* ── 底部 ── */}
      <div className="pt-4 pb-2 text-center opacity-30">
        <div className="h-[1px] w-12 mx-auto bg-gray-300 mb-2" />
        <p className="text-[9px] text-gray-400 tracking-[0.3em]">PoetrySpace · 数据洞察</p>
      </div>
    </div>
  )
}
