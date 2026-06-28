import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/discover', label: '发现', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="max-w-[430px] mx-auto min-h-dvh bg-[#f5f0e8] flex flex-col shadow-2xl relative">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </div>

      {/* 底部导航 */}
      <div className="flex-none border-t border-gray-200 bg-[#f5f0e8]/95 backdrop-blur-sm">
        <div className="flex items-center justify-around py-2">
          {tabs.map(tab => {
            const isActive = location.pathname === tab.path
            return (
              <button key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 transition-colors px-6 py-1 ${
                  isActive ? 'text-[#c23a3a]' : 'text-gray-400'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                <span className="text-[10px]">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
