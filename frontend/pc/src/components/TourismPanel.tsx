/** 文旅交互面板 — 主题路线 / 景点诗词 / 打卡分享 */

import { useState, useEffect, useRef } from 'react'
import { theme as T, sharedStyles as S } from '../theme'

const ST = {
  animBtn: {
    padding: '2px 10px', borderRadius: 3,
    border: '1px solid ' + T.borderDark, background: T.panelBg,
    fontSize: T.fsBody, cursor: 'pointer', fontFamily: 'inherit',
  } as const,
  routeBtn: (color: string, active: boolean) => ({
    ...ST.animBtn, margin: '2px 4px', fontSize: 11,
    background: active ? color + '22' : T.panelBg,
    borderColor: active ? color : T.borderDark,
    color: active ? color : T.text,
  }),
  badge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 8,
    fontSize: 10, background: '#EDE7DB', color: '#8B7355', margin: '0 2px',
  } as const,
}

interface RouteStop { place: string; lon: number; lat: number; desc: string }
interface Route { id: string; name: string; description: string; color: string; stops: RouteStop[] }
interface PoemResult { title: string; author: string; content: string; dynasty: string }

// 从 localStorage 读取打卡记录
function loadCheckins(): string[] {
  try { return JSON.parse(localStorage.getItem('poetry_checkins') || '[]') } catch { return [] }
}
function saveCheckin(place: string) {
  const list = loadCheckins()
  if (!list.includes(place)) {
    list.push(place)
    localStorage.setItem('poetry_checkins', JSON.stringify(list))
  }
  return list
}

export default function TourismPanel({ onRouteSelect }: { onRouteSelect?: (route: Route | null) => void }) {
  const [routes, setRoutes] = useState<Route[]>([])
  const [activeRoute, setActiveRoute] = useState<string | null>(null)
  const [place, setPlace] = useState('')
  const [poems, setPoems] = useState<PoemResult[]>([])
  const [checkins, setCheckins] = useState<string[]>(loadCheckins)
  const [tab, setTab] = useState<'route' | 'place' | 'checkin'>('route')
  const [lastCheckin, setLastCheckin] = useState<string | null>(null)
  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/v1/tourism/routes').then(r => r.json()).then(d => setRoutes(d.routes || [])).catch(() => {})
  }, [])

  const loadPlacePoems = async (name: string) => {
    if (!name.trim()) return
    setPlace(name)
    try {
      const r = await fetch('/api/v1/tourism/places/' + encodeURIComponent(name.trim()) + '/poems')
      const d = await r.json()
      setPoems(d.poems || [])
    } catch { setPoems([]) }
  }

  const handleRouteClick = (r: Route) => {
    const isActive = activeRoute === r.id
    setActiveRoute(isActive ? null : r.id)
    if (onRouteSelect) onRouteSelect(isActive ? null : r)
  }

  const handleCheckin = (placeName: string) => {
    const updated = saveCheckin(placeName)
    setCheckins(updated)
    setLastCheckin(placeName)
    setTimeout(() => setLastCheckin(null), 2000)
  }

  return (
    <div style={{ ...S.panel, borderBottom: 'none' }}>
      <div style={S.sectionTitle}>🏛 文旅交互</div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[
          { key: 'route', label: '路线' },
          { key: 'place', label: '景点' },
          { key: 'checkin', label: `打卡 (${checkins.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ ...ST.animBtn, fontSize: 11, background: tab === t.key ? T.accent : T.panelBg, color: tab === t.key ? '#fff' : T.text }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 4.3.1 主题路线 */}
      {tab === 'route' && (
        <div>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>选择一条主题路线，地图上会显示途经景点</div>
          {routes.map(r => (
            <div key={r.id} style={{
              padding: '6px 8px', margin: '4px 0', borderRadius: 4,
              border: '1px solid ' + (activeRoute === r.id ? r.color : T.border),
              background: activeRoute === r.id ? r.color + '11' : '#fff',
              cursor: 'pointer',
            }} onClick={() => handleRouteClick(r)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textTitle }}>{r.name}</span>
                <span style={{ fontSize: 10, color: '#888', marginLeft: 'auto' }}>{r.stops.length}站</span>
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{r.description}</div>
              {activeRoute === r.id && (
                <div style={{ marginTop: 4, fontSize: 10, color: '#666', lineHeight: 1.6 }}>
                  {r.stops.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                      <span style={{ color: r.color, fontWeight: 600, minWidth: 16 }}>{i + 1}.</span>
                      <span>{s.place}</span>
                      <span style={{ color: '#aaa', fontSize: 9 }}>— {s.desc}</span>
                    </div>
                  ))}
                  <button style={{ ...ST.animBtn, fontSize: 10, marginTop: 4 }}
                    onClick={(e) => { e.stopPropagation(); handleCheckin(r.name) }}>
                    📍 {lastCheckin === r.name ? '已打卡 ✓' : '打卡这条路线'}
                  </button>
                  {lastCheckin === r.name && (
                    <div style={{ fontSize: 10, color: '#4CAF50', marginTop: 2 }}>已记录！切换到「打卡」Tab 查看</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 4.3.3 景点诗词 */}
      {tab === 'place' && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <input type="text" placeholder="输入景点名（如：长安）"
              value={place} onChange={e => {
                const v = e.target.value
                setPlace(v)
                if (placeTimer.current) clearTimeout(placeTimer.current)
                placeTimer.current = setTimeout(() => loadPlacePoems(v), 300)
              }}
              style={{ flex: 1, padding: '3px 6px', border: '1px solid #d0cdc4', borderRadius: 4, fontSize: 11, fontFamily: 'serif' }} />
          </div>
          {poems.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>相关诗词 {poems.length} 首</div>
              {poems.slice(0, 6).map((p, i) => (
                <div key={i} style={{ padding: '4px 6px', margin: '3px 0', border: '1px solid ' + T.border, borderRadius: 3, fontSize: 11, lineHeight: 1.5 }}>
                  <b>{p.title}</b> <span style={{ color: '#888' }}>— {p.author}（{p.dynasty}）</span>
                  <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{p.content}</div>
                </div>
              ))}
            </div>
          )}
          {place && poems.length === 0 && <div style={{ fontSize: 11, color: '#aaa' }}>暂无相关诗词数据</div>}
        </div>
      )}

      {/* 4.3.4 打卡分享 */}
      {tab === 'checkin' && (
        <div>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>
            已打卡 {checkins.length} 个景点/路线
          </div>
          {checkins.length === 0 ? (
            <div style={{ fontSize: 11, color: '#aaa' }}>选择路线后点击"📍 打卡"记录你的足迹</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {checkins.map((c, i) => (
                <span key={i} style={ST.badge}>
                  📍 {c}
                </span>
              ))}
            </div>
          )}
          {checkins.length > 0 && (
            <button style={{ ...ST.animBtn, fontSize: 10, marginTop: 6, width: '100%' }}
              onClick={() => {
                const text = '我在 PoetrySpace 打卡了：' + checkins.join('、')
                if (navigator.share) {
                  navigator.share({ title: 'PoetrySpace 打卡', text }).catch(() => {})
                } else {
                  navigator.clipboard.writeText(text).then(() => alert('已复制打卡信息！')).catch(() => {})
                }
              }}>
              📤 分享打卡记录
            </button>
          )}
        </div>
      )}
    </div>
  )
}
