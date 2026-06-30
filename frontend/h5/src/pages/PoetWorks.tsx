import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPoetPoems } from '../api'
import type { Poem } from '../types'

const PAGE_SIZE = 10

export default function PoetWorks() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [poems, setPoems] = useState<Poem[]>([])
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (id) getPoetPoems(id).then(setPoems).catch(() => {})
  }, [id])

  const totalPages = Math.ceil(poems.length / PAGE_SIZE)
  const pagePoems = poems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#e5ddd0] flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-[#5B4A3E]">全部作品</h1>
        <span className="text-[10px] text-gray-400">{poems.length} 首</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {pagePoems.map((p, i) => (
          <div key={page * PAGE_SIZE + i}
            className="bg-white/60 border border-[#e5ddd0] p-3 cursor-pointer hover:border-[#C23B22] transition-colors"
            style={{ outline: '1px solid #ede8e0', outlineOffset: 1 }}
            onClick={() => navigate(`/detail/${p.poetry_id}`)}>
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-bold text-[#5B4A3E]">{page * PAGE_SIZE + i + 1}. {p.title}</h4>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 whitespace-nowrap">{p.genre}</span>
            </div>
            <p className="text-xs text-gray-500 italic">{(p.content || '').slice(0, 50)}…</p>
          </div>
        ))}
        {poems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无作品数据</div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex-none border-t border-[#e5ddd0] px-4 py-2 flex items-center justify-between bg-white/40">
          <button onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1 border border-[#e5ddd0] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#C23B22] transition-colors">
            上一页
          </button>
          <span className="text-xs text-gray-400">{page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs px-3 py-1 border border-[#e5ddd0] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#C23B22] transition-colors">
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
