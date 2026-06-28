import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPoetPoems } from '../api'
import type { Poem } from '../types'

export default function PoetWorks() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poems, setPoems] = useState<Poem[]>([])

  useEffect(() => {
    if (id) getPoetPoems(id).then(setPoems).catch(() => {})
  }, [id])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="font-bold text-sm">全部作品 ({poems.length})</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {poems.map((p, i) => (
          <div key={i} className="bg-white border border-gray-200 p-4 cursor-pointer hover:border-[#c23a3a]"
            onClick={() => navigate(`/detail/${p.poetry_id}`)}>
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-bold text-sm">{p.title}</h4>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5">{p.genre}</span>
            </div>
            <p className="text-xs text-gray-500 italic">{(p.content || '').slice(0, 40)}…</p>
          </div>
        ))}
        {poems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无作品数据</div>
        )}
      </div>
    </div>
  )
}
