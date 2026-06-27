import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PoetryMap from './components/Map/PoetryMap'
import type { PoetTrajectoryData } from './components/Map/PoetryMap'
import { POET_COLORS } from './components/Map/PoetryMap'
import type { TrajectoryEvent, HeatmapPoint, PlaceName } from './types'
import { getHeatmap, fenceQuery } from './api'
import { theme as T, sharedStyles as S } from './theme'
import AIToolsPanel from './components/AIToolsPanel'
import TourismPanel from './components/TourismPanel'
import PoetryOverlay from './components/PoetryOverlay'
import PoemReadingOverlay from './components/PoemReadingOverlay'
import PoemCompareView from './components/PoemCompareView'
import StatsChart from './components/StatsChart'

const ST = {
  container: { display:'flex', width:'100vw', height:'100vh', fontFamily:'"Noto Serif SC","Source Han Serif SC",serif', color:T.text, overflow:'hidden', background:T.bg } as const,
  sidebar: { width:340, minWidth:340, height:'100vh', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', background:T.sidebarBg, position:'relative' as const, overflowY:'auto' as const },
  header: { padding:T.headerPadding, borderBottom:`1px solid ${T.border}`, background:T.headerBg } as const,
  main: { flex:1, position:'relative' as const },
  statusBar: { height:28, borderTop:`1px solid ${T.border}`, display:'flex', alignItems:'center', padding:'0 16px', fontSize:T.fsSmall, color:T.textMuted, background:T.statusBg } as const,
  slider: { width:'100%', margin:'6px 0', accentColor:T.accent } as const,
  animBtn: { padding:'2px 10px', margin:'0 4px', borderRadius:3, border:`1px solid ${T.borderDark}`, background:T.panelBg, fontSize:T.fsBody, cursor:'pointer', fontFamily:'inherit' } as const,
  chip: { display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', margin:2, borderRadius:3, fontSize:T.fsSmall, background:T.bg, color:T.textSecondary } as const,
  tag: (c:string) => ({ display:'inline-block', padding:'2px 8px', margin:2, borderRadius:3, fontSize:T.fsSmall, background:c+'22', color:c, fontWeight:600 } as const),
} as const

export default function App() {
  // 检索状态
  const [searchQuery, setSearchQuery] = useState('')
  const [unifiedResults, setUnifiedResults] = useState<any>(null)
  const [showUnified, setShowUnified] = useState(false)
  const [searching, setSearching] = useState(false)
  const [compareList, setCompareList] = useState<Array<{title:string;content:string;author?:string;genre?:string;mood_tags?:string[];dynasty?:string}>>([])
  const [showCompare, setShowCompare] = useState(false)

  const [poets, setPoets] = useState<Array<{poet_id:string;name:string;dynasty:string}>>([])
  const [poetSearch, setPoetSearch] = useState('')
  // 多诗人选择（最多10位）
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [poetsData, setPoetsData] = useState<Map<string, TrajectoryEvent[]>>(new Map())
  const [poemsMap, setPoemsMap] = useState<Map<string, Array<{title:string;content:string;genre:string;mood_tags:string[]}>>>(new Map())
  // 单诗人动画（只对最后选中的生效）
  const [animIndex, setAnimIndex] = useState<number|undefined>(undefined)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const animRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  // 热力
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [loading, setLoading] = useState({ heatmap: false, fence: false })

  // 围栏
  const [fenceMode, setFenceMode] = useState(false)
  const [viewingPoet, setViewingPoet] = useState<string|null>(null) // 正在查看作品的诗人ID
  const [showPoemReading, setShowPoemReading] = useState(false)
  const [fenceResults, setFenceResults] = useState<{lat:number;lon:number;places:PlaceName[]}|undefined>(undefined)

  // 交游线段（暂存多诗人间的交游连线）
  const [encounterLines, setEncounterLines] = useState<Array<{from:[number,number];to:[number,number];probability:number}>>([])

  useEffect(() => {
    fetch('/api/v1/poets').then(r=>r.json()).then(d=>setPoets(d.poets||[])).catch(()=>{})
  }, [])

  // 选/取消选诗人
  const togglePoet = useCallback(async (pid: string) => {
    setSelectedIds(prev => {
      const exists = prev.includes(pid)
      if (exists) {
        const next = prev.filter(id => id !== pid)
        setPoetsData(m => { const n = new Map(m); n.delete(pid); return n })
        setPoemsMap(m => { const n = new Map(m); n.delete(pid); return n })
        return next
      }
      if (prev.length >= 10) return prev
      fetch(`/api/v1/poets/${pid}/trajectory`).then(r=>r.json()).then(d => {
        setPoetsData(m => { const n = new Map(m); n.set(pid, d.events || []); return n })
      })
      fetch(`/api/v1/poets/${pid}/poetry`).then(r=>r.json()).then(d => {
        setPoemsMap(m => { const n = new Map(m); n.set(pid, d.poems || []); return n })
      })
      return [...prev, pid]
    })
    setAnimIndex(undefined); setIsPlaying(false)
  }, [])

  // 构建传给地图的诗人数据（useMemo 避免每次渲染重建引用导致地图闪烁）
  const trajectoryPoets: PoetTrajectoryData[] = useMemo(() =>
    selectedIds.map((id, i) => {
      const p = poets.find(p => p.poet_id === id)
      return {
        name: p?.name || id,
        events: poetsData.get(id) || [],
        color: POET_COLORS[i % POET_COLORS.length],
        animIndex: id === selectedIds[selectedIds.length-1] ? animIndex : undefined,
      }
    }),
  [selectedIds, poets, poetsData, animIndex])

  // 动画控制（只对最后选中的生效）
  const lastId = selectedIds[selectedIds.length-1]
  const lastEvents = lastId ? poetsData.get(lastId) || [] : []
  useEffect(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null }
    if (!isPlaying || !lastEvents.length) return
    const delay = Math.max(300, 1200 / speed)
    animRef.current = setInterval(() => {
      setAnimIndex(prev => {
        if (prev === undefined) return 0
        if (prev >= lastEvents.length - 1) { setIsPlaying(false); return lastEvents.length - 1 }
        return prev + 1
      })
    }, delay)
    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [isPlaying, speed, lastEvents.length])

  // 组件卸载时清理搜索防抖定时器
  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }, [])

  // 围栏查询
  const toggleFenceMode = useCallback(() => {
    setFenceMode(v => !v)
    setFenceResults(undefined)
  }, [])

  const handleFenceClick = useCallback(async (lat: number, lon: number) => {
    setLoading(v => ({...v, fence: true}))
    try {
      const data = await fenceQuery(lon, lat)
      setFenceResults({ lat, lon, places: data.places })
      setFenceMode(false)
    } catch {}
    setLoading(v => ({...v, fence: false}))
  }, [])

  const toggleHeatmap = useCallback(async () => {
    setShowHeatmap(v => !v)
    if (!showHeatmap) {
      setLoading(v => ({...v, heatmap: true}))
      try { const d=await getHeatmap(); setHeatmap(d.points||[]) } catch {}
      setLoading(v => ({...v, heatmap: false}))
    } else setHeatmap([])
  }, [showHeatmap])

  // 交游：对选择的诗人两两计算
  useEffect(() => {
    if (selectedIds.length < 2) { setEncounterLines([]); return }
    const calc = async () => {
      const lines: Array<{from:[number,number];to:[number,number];probability:number}> = []
      for (let i = 0; i < selectedIds.length - 1; i++) {
        for (let j = i + 1; j < selectedIds.length; j++) {
          try {
            const r = await fetch('/api/v1/poets/encounter', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({poet_a_id: selectedIds[i], poet_b_id: selectedIds[j]})
            })
            const d = await r.json()
            const evtsA = (poetsData.get(selectedIds[i]) || []).filter(e => e.wgs84_lon && e.wgs84_lat)
            const evtsB = (poetsData.get(selectedIds[j]) || []).filter(e => e.wgs84_lon && e.wgs84_lat)
            if (evtsA.length && evtsB.length) {
              const midA = evtsA[Math.floor(evtsA.length/2)]
              const midB = evtsB[Math.floor(evtsB.length/2)]
              lines.push({ from: [midA.wgs84_lat!, midA.wgs84_lon!], to: [midB.wgs84_lat!, midB.wgs84_lon!], probability: d.probability })
            }
          } catch {}
        }
      }
      setEncounterLines(lines)
    }
    calc()
  }, [selectedIds, poetsData])

  const handlePoemClick = useCallback(async (poem: any) => {
    const poet = poets.find(p => p.name === poem.author)
    if (!poet) return
    setSelectedIds(prev => {
      if (prev.includes(poet.poet_id)) return prev
      fetch('/api/v1/poets/' + poet.poet_id + '/trajectory').then(r=>r.json()).then(d => {
        setPoetsData(m => { const n = new Map(m); n.set(poet.poet_id, d.events || []); return n })
      })
      fetch('/api/v1/poets/' + poet.poet_id + '/poetry').then(r=>r.json()).then(d => {
        if (d?.poems) setPoemsMap(m => { const n = new Map(m); n.set(poet.poet_id, d.poems); return n })
      })
      return [...prev, poet.poet_id]
    })
    setViewingPoet(poet.poet_id)
    setTimeout(() => {
      const el = document.getElementById('poem-view')
      if(el) el.innerHTML='<div style="font-size:14px;font-weight:600;margin-bottom:8px;color:#C23B22">'+poem.title+'</div><div style="font-size:13px;line-height:2;white-space:pre-wrap;font-family:serif">'+poem.content+'</div>'+(poem.mood_tags?.length?'<div style="font-size:11px;color:#888;margin-top:8px">意境: '+poem.mood_tags.join(' · ')+'</div>':'')
      setShowPoemReading(true)
    }, 100)
  }, [poets])

  const poetName = (id: string) => poets.find(p => p.poet_id === id)?.name || id

  return (
    <div style={ST.container}>
      <div style={ST.sidebar}>
        <div style={ST.header}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
            <div style={{width:32,height:32,background:'#5B4A3E',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#F5F0EA',fontSize:16,fontWeight:'bold',fontFamily:'serif'}}>诗</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'#3a3a3a',lineHeight:1.2}}>古诗词文化互动平台</div>
              <div style={{fontSize:10,color:'#999',letterSpacing:1}}>PoetrySpace · 学术工具端</div>
            </div>
          </div>
          <div style={{display:'flex',gap:4,marginTop:8}}>
            <input type="text" value={searchQuery}
              onChange={e=>{
                const v=e.target.value;
                setSearchQuery(v);
                const trimmed=v.trim();
                if(searchTimerRef.current) clearTimeout(searchTimerRef.current);
                if(trimmed.length<1){setShowUnified(false);return}
                setSearching(true)
                searchTimerRef.current=setTimeout(async ()=>{
                  try{
                    const r=await fetch('/api/v1/search/all?keyword='+encodeURIComponent(trimmed));
                    const d=await r.json();
                    setUnifiedResults(d);
                    setShowUnified(true)
                  }catch(e){}
                  setSearching(false)
                },300)
              }}
              onFocus={async ()=>{if(searchQuery.trim().length>=1){try{const r=await fetch('/api/v1/search/all?keyword='+encodeURIComponent(searchQuery.trim()));const d=await r.json();setUnifiedResults(d);setShowUnified(true)}catch(e){}}}}
              placeholder="搜索诗人或诗词..."
              style={{flex:1,padding:'4px 8px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:12,fontFamily:'serif'}} />
            <button style={{...S.classicBtn,padding:'4px 8px',fontSize:11}}
              onClick={()=>setShowUnified(false)}>{showUnified?'✕':'⚙'}</button>
          </div>
        </div>

        {/* 统一搜索浮层 */}
        {showUnified && unifiedResults && (
          <div style={{...S.panel, maxHeight:350, overflowY:'auto', padding:'8px 12px',
            position:'absolute', left:0, right:0, zIndex:100, background:'#FFFEF9', boxShadow:'0 4px 12px rgba(0,0,0,.15)',
            borderBottom:'2px solid #5B4A3E'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:11,color:T.textMuted}}>{searching ? '搜索中...' : '搜索结果'}</span>
              <button onClick={()=>setShowUnified(false)} style={{...ST.animBtn,padding:'0 6px',fontSize:10}}>{'✕'}</button>
            </div>
            {unifiedResults.poets?.length > 0 && (
              <div style={{marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:600,color:T.textTitle,marginBottom:2}}>诗人 ({unifiedResults.poets.length})</div>
                {unifiedResults.poets.map((p: any) =>
                  <div key={p.poet_id} style={{padding:'3px 6px',cursor:'pointer',fontSize:11,borderRadius:3}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    onClick={()=>{togglePoet(p.poet_id);setShowUnified(false);setSearchQuery('')}}>
                    {p.name} <span style={{color:T.textMuted,fontSize:10}}>{p.dynasty}</span>
                  </div>
                )}
              </div>
            )}
            {unifiedResults.poems?.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:600,color:T.textTitle,marginBottom:2}}>
                  诗词 ({unifiedResults.poems.length})
                  {compareList.length > 1 && (
                    <span style={{float:'right',fontWeight:400,fontSize:10,color:T.accent,cursor:'pointer'}}
                      onClick={()=>setShowCompare(true)}>
                      📖 对比 ({compareList.length}首)
                    </span>
                  )}
                </div>
                {unifiedResults.poems.map((r: any) =>
                  <div key={r.poetry_id} style={{padding:'4px 6px',cursor:'pointer',fontSize:11,borderRadius:3,borderBottom:'1px solid '+T.divider}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    onClick={()=>{handlePoemClick(r);setShowUnified(false);setSearchQuery('')}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{flex:1}}><b>{r.title}</b> {'—'} {r.author}</span>
                      <span style={{fontSize:9,color:T.accent,cursor:'pointer',whiteSpace:'nowrap'}}
                        onClick={(e)=>{e.stopPropagation();setCompareList(prev=>{
                          if(prev.find(p=>p.title===r.title))return prev;
                          return [...prev,{title:r.title,content:r.content,author:r.author,genre:r.genre,mood_tags:r.mood_tags,dynasty:r.dynasty}]
                        })}}>
                        +对比
                      </span>
                    </div>
                    <span style={{color:T.textMuted,fontSize:10}}>{r.dynasty}/{r.genre}</span>
                    <div style={{color:'#666',fontSize:10,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.content?.slice(0,40)}...</div>
                  </div>
                )}
              </div>
            )}
            {(!unifiedResults.poets?.length && !unifiedResults.poems?.length) && (
              <div style={{fontSize:11,color:T.textMuted}}>无结果</div>
            )}
          </div>
        )}

        {/* 诗人 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>诗人</div>
          <input type="text" value={poetSearch} onChange={e=>setPoetSearch(e.target.value)}
            placeholder="搜索添加诗人..."
            style={{...S.input, width:'100%', fontSize:T.fsSmall}} />
          {poetSearch && (
            <div style={{maxHeight:150, overflowY:'auto', marginTop:4, border:'1px solid '+T.border, borderRadius:3, padding:4}}>
              {poets.filter(p => p.name.includes(poetSearch) && !selectedIds.includes(p.poet_id)).slice(0, 12).map(p =>
                <div key={p.poet_id} style={{padding:'3px 6px',cursor:'pointer',fontSize:T.fsBody,borderRadius:3}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  onClick={()=>{togglePoet(p.poet_id);setPoetSearch('')}}>
                  {p.name} <span style={{color:T.textMuted,fontSize:10}}>{p.dynasty}</span>
                </div>
              )}
            </div>
          )}
          {selectedIds.length > 0 && (
            <div style={{marginTop:6,fontSize:T.fsSmall,color:T.textMuted,lineHeight:1.8}}>
              {selectedIds.map(id => (
                <span key={id} style={{display:'inline-flex',alignItems:'center',gap:2,marginRight:4,padding:'1px 6px',background:T.bg,borderRadius:3}}>
                  {poetName(id)}
                  <span style={{cursor:'pointer',color:T.accent,fontWeight:600,fontSize:10,marginLeft:2}}
                    onClick={async()=>{
                      try{const r=await fetch(`/api/v1/poets/${id}/poetry`);const d=await r.json();if(d?.poems){setPoemsMap(m=>{const n=new Map(m);n.set(id,d.poems);return n})}}catch{}
                      setViewingPoet(id)
                    }}>[作品]</span>
                  <span style={{cursor:'pointer',color:T.textMuted,fontSize:10,marginLeft:2}} onClick={()=>togglePoet(id)}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 动画 */}
        {lastEvents.length > 0 && (
          <div style={S.panel}>
            <div style={S.sectionTitle}>
              动画 · {poetName(lastId)}
              <span style={{float:'right',fontWeight:400,fontSize:11,color:'#888'}}>
                {animIndex!==undefined ? lastEvents[animIndex]?.event_year : lastEvents[0]?.event_year}~{lastEvents[lastEvents.length-1]?.event_year}
              </span>
            </div>
            <input type="range" style={ST.slider} min={0} max={Math.max(0,lastEvents.length-1)}
              value={animIndex??0} onChange={e=>{setAnimIndex(parseInt(e.target.value));setIsPlaying(false)}} />
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <button style={ST.animBtn} onClick={()=>{if(!isPlaying)setAnimIndex(p=>p===lastEvents.length-1?0:p??0);setIsPlaying(v=>!v)}}>{isPlaying?'⏸':'▶'}</button>
              {[1,2,4].map(s => <button key={s} style={{...ST.animBtn,background:speed===s?'#e8e0d4':'#fff'}} onClick={()=>setSpeed(s)}>{s}×</button>)}
              <span style={{fontSize:11,color:'#888'}}>{animIndex!==undefined?animIndex+1:0}/{lastEvents.length}</span>
            </div>
          </div>
        )}

        {/* 图层 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>图层控制</div>
          <div style={S.layerItem}><input type="checkbox" defaultChecked readOnly /><span>地名</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={selectedIds.length>0} readOnly /><span>轨迹 ({selectedIds.length}人)</span></div>
          <div style={S.layerItem}>
            <input type="checkbox" checked={showHeatmap} onChange={toggleHeatmap} /><span>热力{loading.heatmap ? ' (计算中...)' : ''}</span>
            {showHeatmap && (
              <select id="heat-filter" style={{fontSize:10,padding:'1px 4px',borderRadius:4,border:'1px solid #d0cdc4',marginLeft:4}}
                onChange={async(e)=>{
                  const v=e.target.value;
                  try{const d=await getHeatmap(v||undefined);setHeatmap(d.points||[])}catch{}
                }}>
                <option value="">全部</option><option value="唐">唐代</option><option value="宋">宋代</option>
                <option value="边塞">边塞</option><option value="田园">田园</option>
                <option value="怀古">怀古</option><option value="送别">送别</option>
              </select>
            )}
          </div>
          <div style={S.layerItem}><input type="checkbox" checked={encounterLines.length>0} readOnly /><span>交游 ({encounterLines.length}条)</span></div>
          <div style={S.layerItem}>
            <button style={{...ST.animBtn, background:fenceMode?'#e8e0d4':'#fff', margin:0, fontSize:11}}
              onClick={toggleFenceMode}>{fenceMode ? '退出围栏模式' : '围栏查询'}</button>
            {fenceMode && <span style={{fontSize:11,color:'#E91E63',marginLeft:6}}>点地图查80km内</span>}
            {loading.fence && <span style={{fontSize:11,color:'#888',marginLeft:6}}>查询中...</span>}
          </div>
        </div>

        {/* 文旅交互 */}
        <TourismPanel onRouteSelect={(route) => {
          console.log('Route selected:', route?.name)
        }} />

        {/* AI 创作工具 */}
        <AIToolsPanel />

        {/* 围栏信息 */}
        {fenceResults && (
          <div style={S.panel}>
            <div style={S.sectionTitle}>围栏查询结果</div>
            <div style={{fontSize:12,lineHeight:1.6,color:'#888'}}>
              中心: {fenceResults.lat.toFixed(4)}, {fenceResults.lon.toFixed(4)}
            </div>
            <div style={{fontSize:12,lineHeight:1.6}}>
              范围内: {fenceResults.places.length} 个地名
            </div>
            {fenceResults.places.slice(0, 6).map(p => (
              <div key={p.place_id} style={{fontSize:11,padding:'2px 0',borderBottom:'1px solid #f0eee8'}}>
                {p.ancient_name}（{p.modern_name}）{p.distance_km ? `${p.distance_km.toFixed(1)}km` : ''}
              </div>
            ))}
            <button style={{...ST.animBtn,marginTop:4}} onClick={()=>setFenceResults(undefined)}>清除</button>
          </div>
        )}

        {/* 数据导出 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>数据导出（CSV / Excel / shp）</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[
              {label:'地名 CSV', url:'/api/v1/export/places?format=csv'},
              {label:'地名 XLSX', url:'/api/v1/export/places?format=excel'},
              {label:'地名 shp', url:'/api/v1/export/places?format=shp'},
              {label:'诗人 CSV', url:'/api/v1/export/poets?format=csv'},
              {label:'诗人 XLSX', url:'/api/v1/export/poets?format=excel'},
              {label:'轨迹 CSV', url:'/api/v1/export/trajectories?format=csv'},
              {label:'轨迹 XLSX', url:'/api/v1/export/trajectories?format=excel'},
              {label:'轨迹 shp', url:'/api/v1/export/trajectories?format=shp'},
              {label:'诗词 CSV', url:'/api/v1/export/poetry?format=csv'},
              {label:'诗词 XLSX', url:'/api/v1/export/poetry?format=excel'},
              {label:'交游 CSV', url:'/api/v1/export/encounters?format=csv'},
              {label:'交游 XLSX', url:'/api/v1/export/encounters?format=excel'},
              {label:'统计 JSON', url:'/api/v1/export/stats'},
            ].map(btn => (
              <a key={btn.label} href={btn.url} target="_blank" rel="noopener"
                style={{...ST.animBtn, textDecoration:'none', color:'#333', fontSize:11}}>{btn.label}</a>
            ))}
          </div>
          <div style={{fontSize:10,color:'#aaa',marginTop:4}}>
            支持 CSV、Excel、GIS shp，统计数据以 JSON 下载。
          </div>
        </div>

        {/* 统计图表 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>📊 数据统计</div>
          <StatsChart />
        </div>

        {/* 统计与作品 */}
        <div style={{...S.panel, flex:1, borderBottom:'none', overflow:'auto'}}>
          {selectedIds.length > 0 ? (
            <div>
            {selectedIds.map((id, i) => {
              const evts = poetsData.get(id) || []
              const p = poets.find(p => p.poet_id === id)
              return (
                <div key={id} style={{marginBottom:10}}>
                  <div style={ST.tag(POET_COLORS[i % POET_COLORS.length])}>{p?.name}</div>
                  <div style={{fontSize:11,lineHeight:1.6,color:'#666',marginLeft:4,marginBottom:4}}>
                    {evts.length} 事件 · 年份 {evts[0]?.event_year||'?'}~{evts[evts.length-1]?.event_year||'?'}
                    {(() => {
                      const count = poemsMap.get(id)?.length || 0
                      return count > 0 ? ' · ' + count + ' 首' : null
                    })()}
                  </div>
                </div>
              )
            })}
            </div>
          ) : <div style={{fontSize:12,color:'#aaa'}}>选择诗人开始探索<br/>点击地图可进行围栏查询</div>}
        </div>

        <div style={ST.statusBar}>
          <span>诗人 {selectedIds.length}位 · 轨迹 {trajectoryPoets.reduce((s,p)=>s+p.events.length,0)}条 · 围栏 {fenceResults?.places.length||0}点</span>
          <span style={{fontSize:10,color:'#b8b0a8',marginLeft:'auto'}}>v0.2</span>
        </div>
      </div>

      <div style={ST.main}>
        <PoetryMap poets={trajectoryPoets} heatmap={showHeatmap?heatmap:[]}
          encounterLines={encounterLines} fenceResults={fenceResults}
          fenceMode={fenceMode} onFenceClick={handleFenceClick}
          searchResults={showUnified ? unifiedResults?.poems?.map((r:any)=>({title:r.title,author:r.author})) || [] : []} />
      </div>

      {/* 诗人作品浮层 */}
      {viewingPoet && (() => {
        const poems = poemsMap.get(viewingPoet) || []
        const p = poets.find(pn => pn.poet_id === viewingPoet)
        return (
          <PoetryOverlay
            poetName={p?.name || ''}
            poems={poems}
            onClose={() => setViewingPoet(null)}
            onSelectPoem={(poem) => {
              const el = document.getElementById('poem-view');
              if (el) el.innerHTML = `<div style="font-size:16px;font-weight:600;color:#5B4A3E;margin-bottom:8px;letter-spacing:1px">${poem.title}</div><div style="font-size:13px;color:#888;margin-bottom:10px">${poem.genre || ''}${poem.mood_tags?.length ? ' · ' + poem.mood_tags.join(' · ') : ''}</div><div style="font-size:14px;line-height:2.2;white-space:pre-wrap;font-family:serif;color:#2c2c2c">${poem.content}</div>`
              setShowPoemReading(true)
            }}
          />
        )
      })()}

      {/* 诗词阅读浮层 */}
      <PoemReadingOverlay visible={showPoemReading} onClose={() => setShowPoemReading(false)} />

      {/* 多诗对比浮层 */}
      {showCompare && (
        <PoemCompareView poems={compareList} onClose={() => setShowCompare(false)} />
      )}

    </div>
  )
}
