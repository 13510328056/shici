import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  {
    path: '/',
    label: '首页',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    activePaths: ['/'],
  },
  {
    path: '/discover',
    label: '发现',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    activePaths: ['/discover', '/search'],
  },
  {
    path: '/favorites',
    label: '收藏',
    icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
    activePaths: ['/favorites'],
  },
  {
    path: '/profile',
    label: '我的',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    activePaths: ['/profile'],
  },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (tab: typeof tabs[0]) =>
    tab.activePaths.some(p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p))

  return (
    <div className="max-w-[430px] mx-auto min-h-dvh bg-[#f5f0e8] flex flex-col shadow-2xl relative">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </div>

      {/* 底部导航 */}
      <div className="flex-none border-t border-[#e5ddd0] bg-[#f5f0e8]/95 backdrop-blur-sm">
        <div className="flex items-center justify-around py-1.5">
          {tabs.map(tab => {
            const active = isActive(tab)
            return (
              <button key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 transition-colors px-4 py-1 ${
                  active ? 'text-[#c23a3a]' : 'text-gray-400'
                }`}
              >
                <svg className="w-[22px] h-[22px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
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
