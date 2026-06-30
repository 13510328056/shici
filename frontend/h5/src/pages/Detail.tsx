import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPoemById, getRandomPoem, getRelatedPoems } from '../api'
import type { Poem } from '../types'

interface StudyData {
  annotations: { word: string; meaning: string }[]
  background: string
  critique: string
  allusions: { name: string; source: string }[]
}

const studyTabs = [
  { key: 0, label: '注释', icon: '📖' },
  { key: 1, label: '创作背景', icon: '🏮' },
  { key: 2, label: '名家评注', icon: '🎋' },
  { key: 3, label: '相关典故', icon: '🦋' },
]

export default function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poem, setPoem] = useState<Poem | null>(null)
  const [study, setStudy] = useState<StudyData | null>(null)
  const [related, setRelated] = useState<any[]>([])
  const [studyTab, setStudyTab] = useState(0)

  useEffect(() => {
    if (id === 'random') {
      getRandomPoem().then(p => { setPoem(p); loadStudy(p.poetry_id) }).catch(() => {})
    } else if (id) {
      getPoemById(id).then(p => { setPoem(p); loadStudy(id) }).catch(() => {})
    }
  }, [id])

  const loadStudy = async (pid: string) => {
    try {
      const r = await fetch(`/api/v1/play/poem/${pid}/study`).then(r => r.json())
      setStudy(r)
    } catch {}
    getRelatedPoems(pid).then(r => setRelated(r.related || [])).catch(() => {})
  }

  if (!poem) return (
    <div className="p-8 text-center">
      <div className="inline-block w-6 h-6 border-2 border-[#c23a3a] border-t-transparent rounded-full animate-spin mb-2" />
      <p className="text-gray-400 text-sm">诗词加载中…</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-[#e5ddd0] flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button className="text-gray-400 hover:text-[#c23a3a] transition-colors" onClick={() => {}} title="收藏">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4">
        {/* 标题区 */}
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-[#c23a3a] mb-0.5">{poem.title}</h2>
          <p className="text-gray-500 tracking-wider text-xs">{poem.author} · {poem.dynasty}</p>
          <div className="h-4 my-2" style={{
            background: 'radial-gradient(ellipse at center, rgba(44,44,44,0.1) 0%, transparent 70%)'
          }} />
        </div>

        {/* 正文 */}
        <div className="text-sm leading-[2.4] tracking-[0.15em] text-center mb-6 text-[#3a3a3a] font-serif">
          {poem.content.split(/[，。]/).filter(s => s.trim()).map((line, i) => (
            <p key={i} className="mb-0.5">
              {line}{i < 20 ? (i % 2 === 0 ? '，' : '。') : ''}
            </p>
          ))}
        </div>

        {/* 学习 Tab */}
        <div className="mb-6">
          <div className="flex border-b border-[#e5ddd0] mb-4 overflow-x-auto no-scrollbar gap-1">
            {studyTabs.map(tab => (
              <button key={tab.key}
                onClick={() => setStudyTab(tab.key)}
                className={`px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  studyTab === tab.key
                    ? 'text-[#c23a3a] border-b-2 border-[#c23a3a]'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs leading-relaxed text-gray-600 bg-white/40 p-4 border border-[#e5ddd0] min-h-[90px]">
            {/* 注释 */}
            {studyTab === 0 && (
              study?.annotations?.length ? (
                <div className="space-y-2">
                  {study.annotations.map((a, i) => (
                    <p key={i}>
                      <span className="font-bold text-[#c23a3a]">{a.word}：</span>
                      {a.meaning}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">
                  {(poem.mood_tags || []).length > 0
                    ? `意境：${(poem.mood_tags || []).join('、')}`
                    : '暂无详细注释'}
                </p>
              )
            )}

            {/* 创作背景 */}
            {studyTab === 1 && (
              <p className="text-gray-600 leading-relaxed">{study?.background || '背景信息整理中…'}</p>
            )}

            {/* 名家评注 */}
            {studyTab === 2 && (
              <p className="text-gray-600 italic border-l-3 border-gray-300 pl-3"
                 style={{ borderLeftWidth: 3 }}>
                {study?.critique || '评注信息整理中…'}
              </p>
            )}

            {/* 相关典故 */}
            {studyTab === 3 && (
              study?.allusions?.length ? (
                <div className="space-y-2">
                  {study.allusions.map((a, i) => (
                    <p key={i}>
                      <span className="font-bold text-[#4A6670]">{a.name}：</span>
                      {a.source || '典故出处待考'}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">暂无相关典故</p>
              )
            )}
          </div>
        </div>

        {/* 同作者推荐 */}
        {related.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 mb-3 tracking-widest uppercase">同作者推荐</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((r, i) => (
                <div key={i}
                  className="min-w-[120px] bg-white border border-[#e5ddd0] p-3 cursor-pointer hover:border-[#c23a3a] transition-colors"
                  onClick={() => navigate(`/detail/${r.poetry_id}`)}>
                  <p className="text-xs font-bold mb-1 text-[#5B4A3E]">{r.title}</p>
                  <p className="text-[10px] text-gray-400">{r.author}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
