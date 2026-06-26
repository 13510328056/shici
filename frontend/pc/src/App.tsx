import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PoetryMap from './components/Map/PoetryMap'
import type { PoetTrajectoryData } from './components/Map/PoetryMap'
import { POET_COLORS } from './components/Map/PoetryMap'
import type { TrajectoryEvent, HeatmapPoint, PlaceName } from './types'
import { getHeatmap, fenceQuery } from './api'

const S = {
  container: { display:'flex', width:'100vw', height:'100vh', fontFamily:'serif', color:'#2c2c2c', overflow:'hidden' } as const,
  sidebar: { width:340, minWidth:340, height:'100vh', borderRight:'1px solid #e0e0e0', display:'flex', flexDirection:'column', background:'#fafaf8' } as const,
  header: { padding:'16px 16px 12px', borderBottom:'1px solid #e8e4de', background:'#fff' } as const,
  h1: { fontSize:18, fontWeight:700, color:'#3a3a3a', margin:0 } as const,
  hsub: { fontSize:11, color:'#888', marginTop:2 } as const,
  panel: { padding:'10px 16px', borderBottom:'1px solid #e8e4de' } as const,
  ptitle: { fontSize:12, fontWeight:600, marginBottom:6, color:'#555' } as const,
  btn: { display:'inline-block', padding:'3px 10px', margin:'3px', borderRadius:12, border:'1px solid #d0cdc4', background:'#fff', fontSize:12, cursor:'pointer' } as const,
  btnA: { display:'inline-block', padding:'3px 10px', margin:'3px', borderRadius:12, border:'none', background:'#5B4A3E', fontSize:12, cursor:'pointer', color:'#fff' } as const,
  layerItem: { display:'flex', alignItems:'center', gap:6, padding:'3px 0', fontSize:12 } as const,
  statusBar: { height:28, borderTop:'1px solid #e8e4de', display:'flex', alignItems:'center', padding:'0 16px', fontSize:11, color:'#888', background:'#fff' } as const,
  main: { flex:1, position:'relative' as const },
  slider: { width:'100%', margin:'6px 0', accentColor:'#5B4A3E' } as const,
  animBtn: { padding:'2px 10px', margin:'0 4px', borderRadius:4, border:'1px solid #ccc', background:'#fff', fontSize:12, cursor:'pointer' } as const,
  chip: { display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', margin:2, borderRadius:10, fontSize:11, background:'#f0eee8' } as const,
  tag: (c:string) => ({ display:'inline-block', padding:'2px 8px', margin:2, borderRadius:10, fontSize:11, background:c+'22', color:c, fontWeight:600 } as const),
}

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

  const [poets, setPoets] = useState<Array<{poet_id:string;name:string;dynasty:string}>>([])
  // 多诗人选择
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [poetsData, setPoetsData] = useState<Map<string, TrajectoryEvent[]>>(new Map())
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
        return next
      }
      if (prev.length >= 4) return prev // 最多4人同屏
      // 加载轨迹
      fetch(`/api/v1/poets/${pid}/trajectory`).then(r=>r.json()).then(d => {
        setPoetsData(m => { const n = new Map(m); n.set(pid, d.events || []); return n })
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
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setSearching(true)
    try {
      const r = await fetch(`/api/v1/search/poetry?keyword=${encodeURIComponent(q)}&page_size=30`)
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
    <div style={S.container}>
      <div style={S.sidebar}>
        <div style={S.header}>
          <h1 style={S.h1}>诗词时空</h1>
          <div style={S.hsub}>中国古诗词文化互动平台 | 学术工具端</div>
          <div style={{display:'flex',gap:4,marginTop:8}}>
            <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&doSearch(searchQuery)}
              placeholder="检索诗词（作者/关键词/意象）"
              style={{flex:1,padding:'4px 8px',border:'1px solid #d0cdc4',borderRadius:4,fontSize:12,fontFamily:'serif'}} />
            <button onClick={()=>doSearch(searchQuery)} style={{...S.animBtn,background:'#5B4A3E',color:'#fff',border:'none'}}>检索</button>
          </div>
        </div>

        {/* 检索结果 */}
        {showSearch && (
          <div style={{...S.panel, maxHeight:200, overflow:'auto'}}>
            <div style={S.ptitle}>检索结果 ({searchTotal}条)
              <button onClick={()=>setShowSearch(false)} style={{...S.animBtn,float:'right',padding:'0 6px',fontSize:10}}>关闭</button>
            </div>
            {searchResults.length > 0 ? searchResults.map(r => (
              <div key={r.poetry_id} style={{padding:'4px 0',borderBottom:'1px solid #f0eee8',fontSize:12,cursor:'pointer'}}
                onClick={()=>{setSearchQuery(r.title); alert(r.content.slice(0,80)+'...')}}>
                <b>{r.title}</b> — {r.author}
                <span style={{float:'right',fontSize:10,color:'#888'}}>{r.dynasty}/{r.genre}</span>
                <div style={{fontSize:11,color:'#666'}}>{r.mood_tags?.join(' · ')}</div>
              </div>
            )) : <div style={{fontSize:12,color:'#aaa'}}>无结果</div>}
          </div>
        )}

        {/* 诗人选择（多选） */}
        <div style={S.panel}>
          <div style={S.ptitle}>选择诗人（最多4位，点击切换）</div>
          <div>{poets.map(p => (
            <button key={p.poet_id} style={selectedIds.includes(p.poet_id) ? {
              ...S.btnA, background: POET_COLORS[selectedIds.indexOf(p.poet_id) % POET_COLORS.length],
            } : S.btn}
              onClick={()=>togglePoet(p.poet_id)}>{p.name}</button>
          ))}</div>
          {selectedIds.length > 0 && (
            <div style={{marginTop:6,fontSize:11,color:'#888'}}>
              已选: {selectedIds.map(id => poetName(id)).join(' + ')}
            </div>
          )}
        </div>

        {/* 动画 */}
        {lastEvents.length > 0 && (
          <div style={S.panel}>
            <div style={S.ptitle}>
              动画 · {poetName(lastId)}
              <span style={{float:'right',fontWeight:400,fontSize:11,color:'#888'}}>
                {animIndex!==undefined ? lastEvents[animIndex]?.event_year : lastEvents[0]?.event_year}~{lastEvents[lastEvents.length-1]?.event_year}
              </span>
            </div>
            <input type="range" style={S.slider} min={0} max={Math.max(0,lastEvents.length-1)}
              value={animIndex??0} onChange={e=>{setAnimIndex(parseInt(e.target.value));setIsPlaying(false)}} />
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <button style={S.animBtn} onClick={()=>{if(!isPlaying)setAnimIndex(p=>p===lastEvents.length-1?0:p??0);setIsPlaying(v=>!v)}}>{isPlaying?'⏸':'▶'}</button>
              {[1,2,4].map(s => <button key={s} style={{...S.animBtn,background:speed===s?'#e8e0d4':'#fff'}} onClick={()=>setSpeed(s)}>{s}×</button>)}
              <span style={{fontSize:11,color:'#888'}}>{animIndex!==undefined?animIndex+1:0}/{lastEvents.length}</span>
            </div>
          </div>
        )}

        {/* 图层 */}
        <div style={S.panel}>
          <div style={S.ptitle}>图层控制</div>
          <div style={S.layerItem}><input type="checkbox" defaultChecked readOnly /><span>地名</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={selectedIds.length>0} readOnly /><span>轨迹 ({selectedIds.length}人)</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={showHeatmap} onChange={toggleHeatmap} /><span>热力</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={encounterLines.length>0} readOnly /><span>交游 ({encounterLines.length}条)</span></div>
          <div style={S.layerItem}>
            <button style={{...S.animBtn, background:fenceMode?'#e8e0d4':'#fff', margin:0, fontSize:11}}
              onClick={toggleFenceMode}>{fenceMode ? '退出围栏模式' : '围栏查询'}</button>
            {fenceMode && <span style={{fontSize:11,color:'#E91E63',marginLeft:6}}>点地图查80km内</span>}
          </div>
        </div>

        {/* AI 创作工具 */}
        <div style={S.panel}>
          <div style={S.ptitle}>AI 创作辅助</div>

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
            }} style={S.animBtn}>推荐</button>
          </div>
          <div id="ai-results" style={{minHeight:20,marginBottom:6}}></div>

          <div style={{fontSize:11,color:'#888',marginBottom:4,marginTop:6}}>格律校验</div>
          <textarea id="rhythm-input" placeholder="输入诗句，如：白日依山尽，黄河入海流。" rows={3}
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
            }} style={S.animBtn}>校验</button>
          </div>
          <div id="rhythm-results" style={{minHeight:20,marginTop:4}}></div>
        </div>

        {/* 围栏信息 */}
        {fenceResults && (
          <div style={S.panel}>
            <div style={S.ptitle}>围栏查询结果</div>
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
            <button style={{...S.animBtn,marginTop:4}} onClick={()=>setFenceResults(undefined)}>清除</button>
          </div>
        )}

        {/* 统计 */}
        <div style={{...S.panel, flex:1, borderBottom:'none', overflow:'auto'}}>
          <div style={S.ptitle}>轨迹统计</div>
          {selectedIds.length > 0 ? (
            <div>
            {selectedIds.map((id, i) => {
              const evts = poetsData.get(id) || []
              const p = poets.find(p => p.poet_id === id)
              return (
                <div key={id} style={{marginBottom:8}}>
                  <div style={S.tag(POET_COLORS[i % POET_COLORS.length])}>{p?.name}</div>
                  <div style={{fontSize:11,lineHeight:1.6,color:'#666',marginLeft:4}}>
                    {evts.length} 事件 · 年份 {evts[0]?.event_year||'?'}~{evts[evts.length-1]?.event_year||'?'}
                  </div>
                </div>
              )
            })}
            </div>
          ) : <div style={{fontSize:12,color:'#aaa'}}>选择 1-4 位诗人<br/>点击地图可进行围栏查询</div>}
        </div>

        <div style={S.statusBar}>
          <span>诗人 {selectedIds.length}位 · 轨迹 {trajectoryPoets.reduce((s,p)=>s+p.events.length,0)}条 · 围栏 {fenceResults?.places.length||0}点</span>
        </div>
      </div>

      <div style={S.main}>
        <PoetryMap poets={trajectoryPoets} heatmap={showHeatmap?heatmap:[]}
          encounterLines={encounterLines} fenceResults={fenceResults}
          fenceMode={fenceMode} onFenceClick={handleFenceClick} />
      </div>
    </div>
  )
}
