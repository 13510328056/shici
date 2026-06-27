/** 统计数据图表 — 朝代/体裁/创作地分布 */

import { useState, useEffect } from 'react'

interface StatsData {
  counts: Record<string, number>
  dynasties: Record<string, number>
  genres: Record<string, number>
  top_places: Array<{ place: string; count: number }>
}

const COLORS = ['#FF6B35', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#00BCD4', '#F44336', '#795548']

function BarChart({ data, label, color }: { data: Record<string, number>; label: string; color?: string }) {
  const entries = Object.entries(data).slice(0, 10)
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#5B4A3E', marginBottom: 4 }}>{label}</div>
      {entries.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ minWidth: 48, fontSize: 10, color: '#666', textAlign: 'right' }}>{k}</span>
          <div style={{
            height: 14, width: `${(v / max) * 100}%`, background: color || COLORS[i % COLORS.length],
            borderRadius: 3, minWidth: v > 0 ? 4 : 0, display: 'flex', alignItems: 'center', paddingLeft: 4,
          }}>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{v}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function HBar({ data, color }: { data: Array<{ place: string; count: number }>; color?: string }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#5B4A3E', marginBottom: 4 }}>创作地 TOP 10</div>
      {data.slice(0, 10).map((d, i) => (
        <div key={d.place} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ minWidth: 48, fontSize: 10, color: '#666', textAlign: 'right' }}>{d.place}</span>
          <div style={{
            height: 14, width: `${(d.count / max) * 100}%`, background: color || COLORS[i % COLORS.length],
            borderRadius: 3, minWidth: 4, display: 'flex', alignItems: 'center', paddingLeft: 4,
          }}>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{d.count}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StatsChart() {
  const [data, setData] = useState<StatsData | null>(null)

  useEffect(() => {
    fetch('/api/v1/export/stats').then(r => r.json()).then(d => setData(d)).catch(() => console.warn("统计数据加载失败"))
  }, [])

  if (!data) return <div style={{ fontSize: 11, color: '#aaa', padding: 8 }}>加载中...</div>

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {Object.entries(data.counts || {}).map(([k, v]) => (
          <span key={k} style={{
            padding: '2px 8px', borderRadius: 4, background: '#EDE7DB', fontSize: 10, color: '#5B4A3E',
          }}>
            {k}: <b>{v}</b>
          </span>
        ))}
      </div>
      <BarChart data={data.dynasties || {}} label="诗人朝代分布" />
      <BarChart data={data.genres || {}} label="诗词体裁分布" color="#4CAF50" />
      <HBar data={data.top_places || []} />
    </div>
  )
}
