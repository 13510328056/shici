import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Feihualing() {
  const [char, setChar] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState(0)
  const navigate = useNavigate()

  const submit = async () => {
    if (!char.trim()) return
    setLoading(true)
    try {
      const r = await fetch('/api/v1/play/feihualing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ char: char.trim() }),
      })
      const d = await r.json()
      setResults(prev => [d, ...prev])
      if (d.poem) setScore(s => s + 1)
      setChar('')
    } catch {}
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#e5ddd0] flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-[#5B4A3E]">🌸 飞花令</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-gradient-to-br from-[#4A6670]/5 to-transparent border border-[#e5ddd0] p-4 mb-4"
          style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}>
          <p className="text-xs text-gray-500 mb-3">输入一个汉字，AI 返回包含该字的诗句</p>
          <div className="flex gap-2 mb-2">
            <input type="text" maxLength={1} value={char}
              onChange={e => setChar(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="字"
              className="w-12 h-12 text-center text-xl border border-[#d4c5a9] bg-white/80 text-[#5B4A3E] font-serif focus:outline-none focus:border-[#C23B22]"
            />
            <button onClick={submit} disabled={loading || !char.trim()}
              className="px-5 text-xs text-white transition-opacity"
              style={{ background: 'linear-gradient(135deg, #C23B22, #A12D16)', opacity: loading ? 0.6 : 1 }}>
              {loading ? '查找中…' : '出题'}
            </button>
            <span className="text-xs text-gray-400 self-center ml-auto">得分: {score}</span>
          </div>
        </div>

        <div className="space-y-2">
          {results.map((h, i) => (
            <div key={i} className="bg-white/60 border border-[#e5ddd0] p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex w-6 h-6 rounded-full bg-[#4A6670] text-white items-center justify-center text-xs font-bold">
                  {h.char}
                </span>
                {h.poem ? (
                  <>
                    <span className="text-sm font-bold text-[#5B4A3E]">{h.poem.title}</span>
                    <span className="text-[10px] text-gray-400">— {h.poem.author}（{h.poem.dynasty}）</span>
                  </>
                ) : (
                  <span className="text-xs text-[#C23B22]">{h.message || '未找到'}</span>
                )}
              </div>
              {h.poem?.matching_line && (
                <div className="text-sm font-serif text-[#3a3a3a] mt-1 pl-2 italic border-l-2 border-[#C23B22]">
                  {h.poem.matching_line}
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">试试输入「花」「月」「风」「酒」等字开始飞花令</p>
          )}
        </div>
      </div>
    </div>
  )
}
