/** 飞花令游戏 */

import { useState } from 'react'
import { theme as T } from '../theme'

interface FeihualingResult {
  char: string
  poem: {
    title: string
    author: string
    dynasty: string
    content: string
    matching_line: string
  } | null
  message?: string
}

const ST = {
  animBtn: {
    padding: '2px 10px', borderRadius: 3,
    border: '1px solid ' + T.borderDark, background: T.panelBg,
    fontSize: T.fsBody, cursor: 'pointer', fontFamily: 'inherit',
  } as const,
}

export default function FeihualingPanel() {
  const [inputChar, setInputChar] = useState('')
  const [history, setHistory] = useState<FeihualingResult[]>([])
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState(0)

  const submitChar = async () => {
    const c = inputChar.trim()
    if (!c || c.length !== 1) return
    setLoading(true)
    try {
      const r = await fetch('/api/v1/play/feihualing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ char: c }),
      })
      const d = await r.json()
      setHistory(prev => [d, ...prev])
      if (d.poem) setScore(s => s + 1)
      setInputChar('')
    } catch {}
    setLoading(false)
  }

  return (
    <div style={{ borderBottom: '1px solid ' + T.divider, padding: T.panelPadding }}>
      <div className="ink-title" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textTitle }}>🌸 飞花令</div>
      </div>

      <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>
        输入一个汉字，AI 返回含该字的诗词名句
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input type="text" maxLength={1} placeholder="字" value={inputChar}
          onChange={e => setInputChar(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitChar()}
          style={{
            width: 40, padding: '4px', textAlign: 'center', fontSize: 16, fontFamily: 'serif',
            border: '1px solid #d0cdc4', borderRadius: 4,
          }} />
        <button onClick={submitChar} disabled={loading || !inputChar.trim()}
          style={{ ...ST.animBtn, fontSize: 11, opacity: loading ? 0.6 : 1 }}>
          {loading ? '查找中…' : '出题'}
        </button>
        <span style={{ fontSize: 10, color: '#888', marginLeft: 'auto', lineHeight: '28px' }}>
          得分: {score}
        </span>
      </div>

      {/* 结果列表 */}
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {history.map((h, i) => (
          <div key={i} className="fade-in" style={{
            padding: '6px 8px', margin: '4px 0',
            border: '1px solid #E5DDD0', borderRadius: 3,
            background: h.poem ? '#FFFEF9' : '#FFF5F5',
          }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{
                display: 'inline-block', width: 20, height: 20, borderRadius: '50%',
                background: '#4A6670', color: '#fff', textAlign: 'center',
                lineHeight: '20px', fontSize: 11, fontWeight: 700,
              }}>{h.char}</span>
              {h.poem ? (
                <>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#5B4A3E' }}>{h.poem.title}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>— {h.poem.author}</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: '#C23B22' }}>{h.message || '未找到'}</span>
              )}
            </div>
            {h.poem?.matching_line && (
              <div style={{
                fontSize: 13, fontFamily: 'serif', color: '#333', marginTop: 2,
                padding: '2px 6px', background: '#F8F4EE', borderRadius: 2,
                borderLeft: '2px solid #C23B22',
              }}>
                {h.poem.matching_line}
              </div>
            )}
          </div>
        ))}
        {history.length === 0 && (
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: 16 }}>
            试试输入「花」「月」「风」「酒」等字
          </div>
        )}
      </div>
    </div>
  )
}
