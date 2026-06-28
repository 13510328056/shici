import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDailyPoem, getRandomPoem, getRelatedPoems } from '../api'
import type { Poem } from '../types'

export default function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poem, setPoem] = useState<Poem | null>(null)
  const [related, setRelated] = useState<any[]>([])
  const [studyTab, setStudyTab] = useState(0)

  useEffect(() => {
    if (id === 'random') {
      getRandomPoem().then(setPoem).catch(() => {})
    } else {
      getDailyPoem().then(d => { setPoem(d); return d }).then(d => {
        if (d?.poetry_id) getRelatedPoems(d.poetry_id).then(r => setRelated(r.related || [])).catch(() => {})
      }).catch(() => {})
    }
  }, [id])

  if (!poem) return <div className="p-8 text-center text-gray-400 text-sm">加载中…</div>

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button className="text-[#c23a3a]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4">
        {/* 标题区 */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#c23a3a] mb-1">{poem.title}</h2>
          <p className="text-gray-500 tracking-widest text-sm">{poem.author} · {poem.dynasty}</p>
          <div className="h-5 my-3" style={{
            background: 'radial-gradient(ellipse at center, rgba(44,44,44,0.15) 0%, transparent 70%)'
          }} />
        </div>

        {/* 正文 */}
        <div className="text-base leading-[2.2] tracking-[0.15em] text-center mb-8">
          {poem.content.split(/[，。]/).filter(s => s.trim()).map((line, i) => (
            <p key={i} className="mb-1">
              {line}{i < 20 ? (i % 2 === 0 ? '，' : '。') : ''}
            </p>
          ))}
        </div>

        {/* 学习Tab */}
        <div className="mb-8">
          <div className="flex border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar gap-1">
            {['注释', '创作背景', '名家评注', '相关典故'].map((t, i) => (
              <button key={i}
                onClick={() => setStudyTab(i)}
                className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  studyTab === i ? 'text-[#c23a3a] border-b-2 border-[#c23a3a]' : 'text-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-sm leading-relaxed text-gray-600 bg-white/40 p-4 border border-gray-200 italic min-h-[80px]">
            {studyTab === 0 && poem.mood_tags?.length ? (
              poem.mood_tags.map(t => <span key={t} className="inline-block bg-gray-50 px-2 py-0.5 text-xs text-gray-600 mr-1 mb-1">{t}</span>)
            ) : (
              <p className="text-gray-400">暂无详细注释数据</p>
            )}
            {studyTab === 1 && <p className="text-gray-400">创作背景信息待补充</p>}
            {studyTab === 2 && <p className="text-gray-400 border-l-4 border-gray-300 pl-3">名家评注待补充</p>}
            {studyTab === 3 && <p className="text-gray-400">相关典故待补充</p>}
          </div>
        </div>

        {/* 推荐 */}
        {related.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 mb-3 tracking-widest uppercase">同作者推荐</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((r, i) => (
                <div key={i} className="min-w-[120px] bg-white border border-gray-200 p-3 cursor-pointer hover:border-[#c23a3a]"
                  onClick={() => navigate(`/detail/${r.poetry_id}`)}>
                  <p className="text-xs font-bold mb-1">{r.title}</p>
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
