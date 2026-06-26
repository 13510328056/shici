import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PoetryMap from './components/Map/PoetryMap'
import type { PoetTrajectoryData } from './components/Map/PoetryMap'
import { POET_COLORS } from './components/Map/PoetryMap'
import type { TrajectoryEvent, HeatmapPoint, PlaceName } from './types'
import { getHeatmap, fenceQuery } from './api'
import { theme as T, sharedStyles as S } from './theme'

const ST = {
  container: { display:'flex', width:'100vw', height:'100vh', fontFamily:'"Noto Serif SC","Source Han Serif SC",serif', color:T.text, overflow:'hidden', background:T.bg } as const,
  sidebar: { width:340, minWidth:340, height:'100vh', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', background:T.sidebarBg, position:'relative' as const },
  header: { padding:T.headerPadding, borderBottom:`1px solid ${T.border}`, background:T.headerBg } as const,
  main: { flex:1, position:'relative' as const },
  statusBar: { height:28, borderTop:`1px solid ${T.border}`, display:'flex', alignItems:'center', padding:'0 16px', fontSize:T.fsSmall, color:T.textMuted, background:T.statusBg } as const,
  slider: { width:'100%', margin:'6px 0', accentColor:T.accent } as const,
  animBtn: { padding:'2px 10px', margin:'0 4px', borderRadius:3, border:`1px solid ${T.borderDark}`, background:T.panelBg, fontSize:T.fsBody, cursor:'pointer', fontFamily:'inherit' } as const,
  chip: { display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', margin:2, borderRadius:3, fontSize:T.fsSmall, background:T.bg, color:T.textSecondary } as const,
  tag: (c:string) => ({ display:'inline-block', padding:'2px 8px', margin:2, borderRadius:3, fontSize:T.fsSmall, background:c+'22', color:c, fontWeight:600 } as const),
} as const

// ─── 搜索结果类型 ──────────────────────────
interface SearchResult {
  poetry_id: string; title: string; content: string; author: string;
  dynasty: string; genre: string; mood_tags: string[];
  imagery_items: string[]; place_name: string | null; creation_year: string | null;
}

export default function App() {
  // 检索状态
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchFilters, setSearchFilters] = useState({ dynasty: '', mood: '', season: '' })
  const [showFilters, setShowFilters] = useState(false)

  // 多诗对比
  const [compareList, setCompareList] = useState<SearchResult[]>([])
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

  // 热力
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [showHeatmap, setShowHeatmap] = useState(false)

  // 围栏
  const [fenceMode, setFenceMode] = useState(false)
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
      return [...prev, pid]
    })
    // 在 setSelectedIds 之外发起 fetch
    fetch(`/api/v1/poets/${pid}/trajectory`).then(r=>r.json()).then(d => {
      setPoetsData(m => { const n = new Map(m); n.set(pid, d.events || []); return n })
    })
    fetch(`/api/v1/poets/${pid}/poetry`).then(r=>r.json()).then(d => {
      if (d && d.poems) {
        setPoemsMap(m => { const n = new Map(m); n.set(pid, d.poems); return n })
      }
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

  // 围栏查询
  const toggleFenceMode = useCallback(() => {
    setFenceMode(v => !v)
    setFenceResults(undefined)
  }, [])

  const handleFenceClick = useCallback(async (lat: number, lon: number) => {
    try {
      const data = await fenceQuery(lon, lat)
      setFenceResults({ lat, lon, places: data.places })
      setFenceMode(false)
    } catch {}
  }, [])

  const toggleHeatmap = useCallback(async () => {
    setShowHeatmap(v => !v)
    if (!showHeatmap) { try { const d=await getHeatmap(); setHeatmap(d.points||[]) } catch {} }
    else setHeatmap([])
  }, [showHeatmap])

  // ── 多维检索 ────────────────────────────
  const doSearch = useCallback(async (q: string, filters?: { dynasty?: string; mood?: string; season?: string }) => {
    if (!q.trim() && !filters?.mood && !filters?.dynasty) return
    setSearching(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('keyword', q.trim())
      if (filters?.dynasty) params.set('dynasty', filters.dynasty)
      if (filters?.mood) params.set('mood_tag', filters.mood)
      if (filters?.season) params.set('season', filters.season)
      params.set('page_size', '30')
      const r = await fetch(`/api/v1/search/poetry?${params}`)
      const d = await r.json()
      setSearchResults(d.results || [])
      setSearchTotal(d.total || 0)
      setShowSearch(true)
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [])

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
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <div style={{display:'flex',gap:4,marginTop:8}}>
            <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&doSearch(searchQuery)}
              placeholder="检索诗词（作者/关键词/意象）"
              style={{flex:1,padding:'4px 8px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:12,fontFamily:'serif'}} />
            <button onClick={()=>doSearch(searchQuery, searchFilters.dynasty||searchFilters.mood||searchFilters.season ? searchFilters : undefined)} style={{...S.accentBtn, padding:'4px 12px'}}>检索</button>
            <button onClick={()=>setShowFilters(v=>!v)} style={{...S.classicBtn, padding:'4px 10px'}}>{showFilters ? '✕' : '⚙'}</button>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          {showFilters && (
            <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
              <select value={searchFilters.dynasty} onChange={e=>setSearchFilters(f=>({...f,dynasty:e.target.value}))} style={{...S.input,fontSize:T.fsSmall,padding:'2px 6px',flex:1}}>
                <option value="">朝代</option><option value="唐">唐</option><option value="宋">宋</option>
              </select>
              <select value={searchFilters.mood} onChange={e=>setSearchFilters(f=>({...f,mood:e.target.value}))} style={{...S.input,fontSize:T.fsSmall,padding:'2px 6px',flex:1}}>
                <option value="">意境</option><option value="边塞">边塞</option><option value="送别">送别</option><option value="思乡">思乡</option><option value="田园">田园</option><option value="怀古">怀古</option><option value="豪放">豪放</option><option value="婉约">婉约</option>
              </select>
              <select value={searchFilters.season} onChange={e=>setSearchFilters(f=>({...f,season:e.target.value}))} style={{...S.input,fontSize:T.fsSmall,padding:'2px 6px',flex:1}}>
                <option value="">季节</option><option value="春">春</option><option value="夏">夏</option><option value="秋">秋</option><option value="冬">冬</option>
              </select>
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          )}
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

        {/* 检索结果（浮动在上层，不占流式位置） */}
        {showSearch && (
          <div style={{...S.panel, maxHeight:300, overflowY:'auto', padding:'8px 16px',
            position:'absolute', left:0, right:0, zIndex:100, background:'#fafaf8', boxShadow:'0 4px 12px rgba(0,0,0,.15)',
            borderBottom:'2px solid #5B4A3E'}}>
            <div style={S.sectionTitle}>检索结果 ({searchTotal}条)
              <button onClick={()=>setShowSearch(false)} style={{...ST.animBtn,float:'right',padding:'0 6px',fontSize:10}}>关闭</button>
              {compareList.length>=2 && <button onClick={()=>setShowCompare(true)} style={{...ST.animBtn,float:'right',padding:'0 6px',fontSize:10,marginRight:4,background:'#5B4A3E',color:'#fff'}}>对比({compareList.length})</button>}
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            {searchResults.length > 0 ? searchResults.map(r => (
              <div key={r.poetry_id} style={{padding:'6px 4px',borderBottom:'1px solid #f0eee8',fontSize:12,lineHeight:1.6}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                  <input type="checkbox" checked={compareList.some(c=>c.poetry_id===r.poetry_id)} onChange={()=>{
                    setCompareList(prev => prev.some(c=>c.poetry_id===r.poetry_id) ? prev.filter(c=>c.poetry_id!==r.poetry_id) : [...prev, r])
                  }} style={{marginTop:2}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{cursor:'pointer',wordBreak:'break-word'}} onClick={()=>alert(r.content)}>
                      <b>{r.title}</b> — {r.author}
                      <span style={{float:'right',fontSize:10,color:'#888',marginLeft:4}}>{r.dynasty}/{r.genre}</span>
                      {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                    <div style={{fontSize:11,color:'#666',wordBreak:'break-word',lineHeight:1.5,marginTop:2}}>
                      {r.mood_tags?.join(' · ')}{r.mood_tags?.length && r.imagery_items?.length ? ' | ' : ''}{r.imagery_items?.slice(0,5).join(' · ')}
                      {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                    {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                  {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            )) : <div style={{fontSize:12,color:'#aaa',padding:'8px 0'}}>无结果，试试单字如"酒""月"</div>}
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
        )}

        {/* 诗人选择（多选） */}
                <div style={S.panel}>
          <div style={S.sectionTitle}>选择诗人</div>
          <input type="text" value={poetSearch} onChange={e=>setPoetSearch(e.target.value)}
            placeholder="搜索诗人姓名..."
            style={{...S.input, width:'100%', marginBottom:6, fontSize:T.fsSmall}} />
          <div style={{maxHeight:180, overflowY:'auto', marginBottom:4}}>
            {poets.filter(p => !poetSearch || p.name.includes(poetSearch)).map(p =>
              <button key={p.poet_id} style={selectedIds.includes(p.poet_id) ? {
                ...S.classicBtn, background: POET_COLORS[selectedIds.indexOf(p.poet_id) % POET_COLORS.length], color:'#fff', border:'none',
              } : S.classicBtn}
                onClick={()=>togglePoet(p.poet_id)}>{p.name}</button>
            )}
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          {selectedIds.length > 0 && (
            <div style={{marginTop:4,fontSize:T.fsSmall,color:T.textMuted}}>
              已选 {selectedIds.length} 位: {selectedIds.map(id => poetName(id)).join(' · ')}
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          )}
          <div style={{fontSize:10,color:T.textMuted,marginTop:4}}>载入 {poets.length} 位唐宋诗人 · 搜索过滤</div>
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

        {/* 动画 */}
        {lastEvents.length > 0 && (
          <div style={S.panel}>
            <div style={S.sectionTitle}>
              动画 · {poetName(lastId)}
              <span style={{float:'right',fontWeight:400,fontSize:11,color:'#888'}}>
                {animIndex!==undefined ? lastEvents[animIndex]?.event_year : lastEvents[0]?.event_year}~{lastEvents[lastEvents.length-1]?.event_year}
              </span>
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            <input type="range" style={ST.slider} min={0} max={Math.max(0,lastEvents.length-1)}
              value={animIndex??0} onChange={e=>{setAnimIndex(parseInt(e.target.value));setIsPlaying(false)}} />
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <button style={ST.animBtn} onClick={()=>{if(!isPlaying)setAnimIndex(p=>p===lastEvents.length-1?0:p??0);setIsPlaying(v=>!v)}}>{isPlaying?'⏸':'▶'}</button>
              {[1,2,4].map(s => <button key={s} style={{...ST.animBtn,background:speed===s?'#e8e0d4':'#fff'}} onClick={()=>setSpeed(s)}>{s}×</button>)}
              <span style={{fontSize:11,color:'#888'}}>{animIndex!==undefined?animIndex+1:0}/{lastEvents.length}</span>
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
        )}

        {/* 图层 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>图层控制</div>
          <div style={S.layerItem}><input type="checkbox" defaultChecked readOnly /><span>地名</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={selectedIds.length>0} readOnly /><span>轨迹 ({selectedIds.length}人)</span></div>
          <div style={S.layerItem}>
            <input type="checkbox" checked={showHeatmap} onChange={toggleHeatmap} /><span>热力</span>
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
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <div style={S.layerItem}><input type="checkbox" checked={encounterLines.length>0} readOnly /><span>交游 ({encounterLines.length}条)</span></div>
          <div style={S.layerItem}>
            <button style={{...ST.animBtn, background:fenceMode?'#e8e0d4':'#fff', margin:0, fontSize:11}}
              onClick={toggleFenceMode}>{fenceMode ? '退出围栏模式' : '围栏查询'}</button>
            {fenceMode && <span style={{fontSize:11,color:'#E91E63',marginLeft:6}}>点地图查80km内</span>}
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

        {/* AI 创作工具 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>AI 创作辅助</div>

          {/* 对仗推荐 */}
          <div style={{fontSize:11,color:'#888',marginBottom:4}}>对仗推荐</div>
          <div style={{display:'flex',gap:4,marginBottom:6}}>
            <input type="text" id="ai-input" placeholder="输入字词"
              style={{flex:1,padding:'3px 6px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:12,fontFamily:'serif'}} />
            <button onClick={async()=>{
              const v=(document.getElementById('ai-input') as HTMLInputElement).value;
              if(!v)return;
              const d=await fetch('/api/v1/ai/antithesis/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input_text:v})}).then(r=>r.json());
              const el=document.getElementById('ai-results');
              if(el) el.innerHTML=(d.candidates||[]).map((c:any)=>'<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:8px;border:1px solid #e0dcd4;font-size:12px">'+c.word+' <small style="color:#888">'+c.category+'</small></span>').join('')||'<span style="font-size:11px;color:#aaa">无推荐</span>';
            }} style={ST.animBtn}>推荐</button>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <div id="ai-results" style={{minHeight:20,marginBottom:6}}></div>

          {/* 格律校验 */}
          <div style={{fontSize:11,color:'#888',marginBottom:4}}>格律校验</div>
          <textarea id="rhythm-input" placeholder="输入诗句" rows={2}
            style={{width:'100%',padding:'4px 6px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:12,fontFamily:'serif',resize:'vertical'}} />
          <div style={{display:'flex',gap:4,marginTop:4}}>
            <select id="rhythm-genre" style={{padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              <option value="七绝">七绝</option><option value="七律">七律</option>
              <option value="五绝" selected>五绝</option><option value="五律">五律</option>
            </select>
            <button onClick={async()=>{
              const c=(document.getElementById('rhythm-input') as HTMLTextAreaElement).value;
              const g=(document.getElementById('rhythm-genre') as HTMLSelectElement).value;
              if(!c)return;
              const d=await fetch('/api/v1/ai/rhythm/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:c,genre:g,rhyme_system:'平水韵'})}).then(r=>r.json());
              const el=document.getElementById('rhythm-results');
              if(!el)return;
              if(d.passed){el.innerHTML='<span style="font-size:12px;color:#4CAF50">格律无误</span>'}
              else{el.innerHTML='<div style="font-size:12px;color:#E91E63">发现 '+d.errors.length+' 处问题：</div>'+d.errors.map((e:any)=>'<div style="font-size:11px;color:#666;padding:2px 0"><span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#fdd;margin-right:4px;font-size:10px">'+e.type+'</span>'+String(e.message||'').slice(0,50)+'</div>').join('')}
            }} style={ST.animBtn}>校验</button>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <div id="rhythm-results" style={{minHeight:20,marginTop:4,marginBottom:6}}></div>

          {/* 仿写改写 */}
          <div style={{fontSize:11,color:'#888',marginBottom:4}}>仿写改写</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
            <select id="rw-mode" style={{flex:1,minWidth:60,padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              <option value="style">风格仿写</option><option value="expand">短句扩写</option>
              <option value="convert">体裁互转</option><option value="perspective">视角改写</option>
            </select>
            <select id="rw-style" style={{width:80,padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              <option value="唐诗雄浑">唐诗雄浑</option><option value="宋词婉约">宋词婉约</option>
              <option value="边塞豪放">边塞豪放</option>
            </select>
            <select id="rw-genre" style={{width:60,padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              <option value="七绝">七绝</option><option value="七律">七律</option>
              <option value="五绝" selected>五绝</option>
            </select>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <textarea id="rw-input" placeholder="输入诗句或关键词" rows={2}
            style={{width:'100%',padding:'4px 6px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:12,fontFamily:'serif',resize:'vertical'}} />
          <button onClick={async()=>{
            const mode=(document.getElementById('rw-mode') as HTMLSelectElement).value;
            const style=(document.getElementById('rw-style') as HTMLSelectElement).value;
            const genre=(document.getElementById('rw-genre') as HTMLSelectElement).value;
            const input=(document.getElementById('rw-input') as HTMLTextAreaElement).value;
            let url='', body={};
            if(mode==='style'){url='/api/v1/ai/rewrite/style';body={content:input,style,genre}}
            else if(mode==='expand'){url='/api/v1/ai/rewrite/expand';body={input,genre}}
            else if(mode==='convert'){url='/api/v1/ai/rewrite/convert';body={content:input,from_genre:genre,to_genre:genre==='五绝'?'七绝':'五绝'}}
            else{url='/api/v1/ai/rewrite/perspective';body={content:input,perspective:style==='唐诗雄浑'?'隐士':'游子'}}
            try{
              const d=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
              const el=document.getElementById('rw-results');
              if(el) el.innerHTML='<div style="font-size:12px;line-height:1.8;color:#333;padding:6px;background:#f5f0ea;border-radius:4px">'+(d.result||d.error||'无结果')+'</div>'+(d.note?'<div style="font-size:10px;color:#888;margin-top:2px">'+d.note+'</div>':'');
            }catch(e){}
          }} style={{...ST.animBtn,width:'100%',marginTop:4}}>生成</button>
          <div id="rw-results" style={{minHeight:20,marginTop:4,marginBottom:4}}></div>

          {/* 意境匹配 */}
          <div style={{fontSize:11,color:'#888',marginBottom:4}}>意境匹配创作</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
            <select id="mood-select" style={{flex:1,minWidth:80,padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              {['山水','送别','思乡','边塞','田园','怀古','登临','闺怨'].map(m => <option key={m} value={m} selected={m==='山水'}>{m}</option>)}
            </select>
            <select id="mood-season" style={{width:60,padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              <option value="">四季</option><option value="春">春</option><option value="夏">夏</option><option value="秋">秋</option><option value="冬">冬</option>
            </select>
            <select id="mood-level" style={{width:60,padding:'2px 4px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:11}}>
              <option value="入门">入门</option><option value="进阶">进阶</option>
            </select>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <button onClick={async()=>{
            const mood=(document.getElementById('mood-select') as HTMLSelectElement).value;
            const season=(document.getElementById('mood-season') as HTMLSelectElement).value;
            const level=(document.getElementById('mood-level') as HTMLSelectElement).value;
            const d=await fetch('/api/v1/ai/mood/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mood_tag:mood,season,level})}).then(r=>r.json());
            const el=document.getElementById('mood-results');
            if(!el)return;
            el.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:4px">【'+d.mood+'】'+d.description+'</div>'+
              '<div style="font-size:11px;color:#666;margin-bottom:4px">推荐意象：'+d.recommended_imagery.join('、')+'</div>'+
              (d.framework?.tips?.length ? '<div style="font-size:11px;color:#555">创作提示：<ul style="margin:2px 0;padding-left:16px">'+d.framework.tips.map((t:string)=>'<li>'+t+'</li>').join('')+'</ul></div>' : '');
          }} style={{...ST.animBtn,width:'100%',marginTop:2}}>生成创作框架</button>
          <div id="mood-results" style={{minHeight:20,marginTop:6,fontSize:12,lineHeight:1.6}}></div>
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

        {/* 围栏信息 */}
        {fenceResults && (
          <div style={S.panel}>
            <div style={S.sectionTitle}>围栏查询结果</div>
            <div style={{fontSize:12,lineHeight:1.6,color:'#888'}}>
              中心: {fenceResults.lat.toFixed(4)}, {fenceResults.lon.toFixed(4)}
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            <div style={{fontSize:12,lineHeight:1.6}}>
              范围内: {fenceResults.places.length} 个地名
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            {fenceResults.places.slice(0, 6).map(p => (
              <div key={p.place_id} style={{fontSize:11,padding:'2px 0',borderBottom:'1px solid #f0eee8'}}>
                {p.ancient_name}（{p.modern_name}）{p.distance_km ? `${p.distance_km.toFixed(1)}km` : ''}
                {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            ))}
            <button style={{...ST.animBtn,marginTop:4}} onClick={()=>setFenceResults(undefined)}>清除</button>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
        )}

        {/* 数据导出 */}
        <div style={S.panel}>
          <div style={S.sectionTitle}>数据导出 (CSV)</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[
              {label:'地名', url:'/api/v1/export/places'},
              {label:'诗人', url:'/api/v1/export/poets'},
              {label:'轨迹', url:'/api/v1/export/trajectories'},
              {label:'诗词', url:'/api/v1/export/poetry'},
              {label:'交游', url:'/api/v1/export/encounters'},
              {label:'统计', url:'/api/v1/export/stats'},
            ].map(btn => (
              <a key={btn.label} href={btn.url} target="_blank" rel="noopener"
                style={{...ST.animBtn, textDecoration:'none', color:'#333', fontSize:11}}>{btn.label}</a>
            ))}
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          <div style={{fontSize:10,color:'#aaa',marginTop:4}}>UTF-8 CSV，Excel 打开建议"数据→自文本/CSV"</div>
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

        {/* 统计与作品 */}
        <div style={{...S.panel, flex:1, borderBottom:'none', overflow:'auto'}}>
          {selectedIds.length > 0 ? (
            <div>
            {selectedIds.map((id, i) => {
              const evts = poetsData.get(id) || []
              const p = poets.find(p => p.poet_id === id)
              const poems = poemsMap.get(id) || []
              return (
                <div key={id} style={{marginBottom:10}}>
                  <div style={ST.tag(POET_COLORS[i % POET_COLORS.length])}>{p?.name}</div>
                  <div style={{fontSize:11,lineHeight:1.6,color:'#666',marginLeft:4,marginBottom:4}}>
                    {evts.length} 事件 · 年份 {evts[0]?.event_year||'?'}~{evts[evts.length-1]?.event_year||'?'}
                    {poems.length > 0 && ' · ' + poems.length + ' 首作品'}
                    {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                  {poems.length > 0 && (
                    <div style={{borderLeft:'2px solid '+T.border, paddingLeft:8, marginLeft:4}}>
                      {poems.slice(0, 8).map(poem => (
                        <div key={poem.title} style={{fontSize:11, lineHeight:1.6, padding:'2px 0', cursor:'pointer'}}
                          onClick={() => alert(poem.content)}>
                          <span style={{color:T.textTitle}}>{poem.title}</span>
                          <span style={{color:T.textMuted, marginLeft:4}}>{poem.genre}</span>
                          {poem.mood_tags?.length > 0 && (
                            <span style={{color:T.textMuted, marginLeft:4, fontSize:10}}>{poem.mood_tags.slice(0,3).join(',')}</span>
                          )}
                          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                      ))}
                      {poems.length > 8 && <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>共 {poems.length} 首</div>}
                      {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
                  )}
                  {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
              )
            })}
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          ) : <div style={{fontSize:12,color:'#aaa'}}>选择诗人开始探索<br/>点击地图可进行围栏查询</div>}
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

        <div style={ST.statusBar}>
          <span>诗人 {selectedIds.length}位 · 轨迹 {trajectoryPoets.reduce((s,p)=>s+p.events.length,0)}条 · 围栏 {fenceResults?.places.length||0}点</span>
          <span style={{fontSize:10,color:'#b8b0a8',marginLeft:'auto'}}>v0.2</span>
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
        {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

      <div style={ST.main}>
        <PoetryMap poets={trajectoryPoets} heatmap={showHeatmap?heatmap:[]}
          encounterLines={encounterLines} fenceResults={fenceResults}
          fenceMode={fenceMode} onFenceClick={handleFenceClick}
          searchResults={showSearch ? searchResults.map(r=>({title:r.title,author:r.author})) : []} />
        {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>

      {/* 多诗对比浮层 */}
      {showCompare && compareList.length >= 2 && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowCompare(false)}>
          <div style={{background:'#fff',borderRadius:8,maxWidth:'80%',maxHeight:'80%',overflow:'auto',padding:20,boxShadow:'0 4px 20px rgba(0,0,0,.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <h2 style={{fontSize:16,fontWeight:600,margin:0}}>诗词对比</h2>
              <button onClick={()=>setShowCompare(false)} style={{...ST.animBtn}}>关闭</button>
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {compareList.map(r => (
                <div key={r.poetry_id} style={{flex:'1 1 300px',border:'1px solid #e0dcd4',borderRadius:8,padding:12,background:'#fafaf8'}}>
                  <div style={{fontSize:14,fontWeight:600}}>{r.title}</div>
                  <div style={{fontSize:12,color:'#888',marginBottom:8}}>{r.author} · {r.dynasty} · {r.genre}</div>
                  <div style={{fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap',fontFamily:'serif'}}>{r.content}</div>
                  {r.mood_tags?.length > 0 && <div style={{marginTop:8,fontSize:11,color:'#888'}}>意境: {r.mood_tags.join(' · ')}</div>}
                  {r.imagery_items?.length > 0 && <div style={{fontSize:11,color:'#888'}}>意象: {r.imagery_items.slice(0,5).join(' · ')}</div>}
                  {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
              ))}
              {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
            {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
          {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
      )}
      {/* 诗词阅读浮层 */}
      <div id="poem-overlay" style={{display:'none',position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:9999,alignItems:'center',justifyContent:'center'}}
        onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}>
        <div style={{background:'#FFFEF9', borderRadius:8, maxWidth:'80%', maxHeight:'80%', overflow:'auto', padding:24, boxShadow:'0 8px 30px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
          <div id="poem-view"></div>
          <button onClick={()=>{const el=document.getElementById('poem-overlay');if(el)el.style.display='none';}}
            style={{...ST.animBtn, marginTop:12}}>关闭</button>
        </div>
      </div>
    </div>
  )
}
