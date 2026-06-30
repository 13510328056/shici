import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface FavoriteItem {
  id: string
  title: string
  author: string
  type: 'poem' | 'poet'
  time: number
}

export default function Favorites() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem('h5_favorites') || '[]')
      setItems(data)
    } catch { setItems([]) }
  }, [])

  const removeItem = (id: string) => {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    localStorage.setItem('h5_favorites', JSON.stringify(updated))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-200 flex-none">
        <h1 className="text-lg font-bold text-[#5B4A3E]">我的收藏</h1>
        <p className="text-[10px] text-gray-400 mt-0.5">共 {items.length} 项</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-30">📖</div>
            <p className="text-sm text-gray-400">还没有收藏内容</p>
            <p className="text-[10px] text-gray-300 mt-1">在诗词页面点击❤️即可收藏</p>
          </div>
        )}
        {items.map(item => (
          <div key={item.id}
            className="bg-white border border-[#e5ddd0] p-3 flex items-center justify-between cursor-pointer
                       hover:border-[#C23B22] transition-colors"
            onClick={() => navigate(item.type === 'poem' ? `/detail/${item.id}` : `/poet/${item.id}`)}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.type === 'poem' ? '📝' : '👤'}</span>
              <div>
                <p className="text-sm font-bold text-[#5B4A3E]">{item.title}</p>
                <p className="text-[10px] text-gray-400">{item.author}</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
              className="text-gray-300 hover:text-[#C23B22] text-xs transition-colors">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
