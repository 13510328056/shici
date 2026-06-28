import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="text-6xl mb-4 opacity-30">📜</div>
      <h2 className="text-xl font-bold text-[#5B4A3E] mb-2">页面未找到</h2>
      <p className="text-sm text-gray-400 mb-6">您访问的页面不存在或已被移除</p>
      <button onClick={() => navigate('/')}
        className="px-6 py-2 bg-[#2c2c2c] text-[#f5f0e8] text-sm tracking-wider hover:bg-black transition-colors">
        返回首页
      </button>
    </div>
  )
}
