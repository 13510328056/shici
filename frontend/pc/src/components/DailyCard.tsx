/** 每日诗词卡片 — 古风竖排设计 */

import { useState, useEffect } from 'react'

interface DailyPoem {
  title: string
  content: string
  author: string
  dynasty: string
  genre: string
  mood_tags: string[]
  imagery_items: string[]
  season: string[]
  date: string
}

export default function DailyCard() {
  const [poem, setPoem] = useState<DailyPoem | null>(null)

  useEffect(() => {
    fetch('/api/v1/play/daily').then(r => r.json()).then(d => setPoem(d)).catch(() => {})
  }, [])

  if (!poem) return null

  return (
    <div className="fade-in" style={{
      margin: '4px 0', padding: '12px 14px',
      background: 'linear-gradient(135deg, #F8F4EE 0%, #FFFEF9 100%)',
      border: '1px solid #D4C5A9',
      outline: '1px solid #EDE8E0', outlineOffset: 2,
      borderRadius: 3, position: 'relative',
    }}>
      {/* 卷轴装饰条 */}
      <div className="scroll-rod" style={{ marginBottom: 8 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 9, color: '#B0A89C', letterSpacing: 1 }}>每日一诗</span>
          <span className="seal" style={{ marginLeft: 6 }}>{poem.dynasty}</span>
        </div>
      </div>

      <div className="calligraphy" style={{ fontSize: 16, fontWeight: 600, color: '#5B4A3E', letterSpacing: 1, marginBottom: 2 }}>
        {poem.title}
      </div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
        {poem.author} · {poem.genre}
      </div>

      <div style={{
        fontSize: 13, lineHeight: 2, fontFamily: 'serif', color: '#333',
        borderLeft: '2px solid #E5DDD0', paddingLeft: 10, marginBottom: 6,
      }}>
        {poem.content.slice(0, 80)}{poem.content.length > 80 ? '…' : ''}
      </div>

      {poem.mood_tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {poem.mood_tags.slice(0, 3).map(t => (
            <span key={t} style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 6,
              background: '#EDE7DB', color: '#8B7355',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* 底部卷轴 */}
      <div className="scroll-rod" style={{ marginTop: 8 }} />
    </div>
  )
}
