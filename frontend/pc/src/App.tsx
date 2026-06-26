import { useState, useEffect, useCallback, useRef } from 'react'
import PoetryMap from './components/Map/PoetryMap'
import type { TrajectoryEvent, HeatmapPoint } from './types'
import { getHeatmap } from './api'
import { EVENT_COLORS } from './types'

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
}

export default function App() {
  const [poets, setPoets] = useState<Array<{poet_id:string;name:string;dynasty:string}>>([])
  const [selectedPoet, setSelectedPoet] = useState<string|null>(null)
  const [trajectory, setTrajectory] = useState<TrajectoryEvent[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [showHeatmap, setShowHeatmap] = useState(false)

  // 动画状态
  const [animIndex, setAnimIndex] = useState<number|undefined>(undefined)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1) // 1, 2, 4
  const [yearRange, setYearRange] = useState<[number,number]>([600, 1300])
  const animRef = useRef<ReturnType<typeof setInterval>|null>(null)

  // 交游状态
  const [poetB, setPoetB] = useState<string|null>(null)
  const [encounterProb, setEncounterProb] = useState<number|null>(null)
  const [encounterLines, setEncounterLines] = useState<Array<{from:[number,number];to:[number,number];probability:number}>>([])

  // 加载诗人列表
  useEffect(() => {
    fetch('/api/v1/poets').then(r=>r.json()).then(d=>setPoets(d.poets||[])).catch(()=>{})
  }, [])

  // 选择诗人
  const handleSelectPoet = useCallback(async (pid: string) => {
    if (selectedPoet === pid) { setSelectedPoet(null); setTrajectory([]); setAnimIndex(undefined); setIsPlaying(false); return }
    setSelectedPoet(pid)
    try {
      const r = await fetch(`/api/v1/poets/${pid}/trajectory`)
      const data = await r.json()
      const evts: TrajectoryEvent[] = data.events || []
      setTrajectory(evts)
      setAnimIndex(undefined)
      setIsPlaying(false)
      if (evts.length > 0) {
        const years = evts.filter(e => e.event_year).map(e => parseInt(e.event_year)).filter(n => !isNaN(n))
        if (years.length > 0) setYearRange([Math.min(...years), Math.max(...years)])
      }
    } catch { setTrajectory([]) }
  }, [selectedPoet])

  // 动画控制
  useEffect(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null }
    if (!isPlaying || trajectory.length === 0) return
    const delay = Math.max(300, 1200 / speed)
    animRef.current = setInterval(() => {
      setAnimIndex(prev => {
        if (prev === undefined) return 0
        if (prev >= trajectory.length - 1) { setIsPlaying(false); return trajectory.length - 1 }
        return prev + 1
      })
    }, delay)
    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [isPlaying, speed, trajectory.length])

  const togglePlay = useCallback(() => {
    if (!isPlaying) setAnimIndex(prev => prev === trajectory.length - 1 ? 0 : (prev ?? 0))
    setIsPlaying(v => !v)
  }, [isPlaying, trajectory.length])

  // 交游计算
  const calcEncounter = useCallback(async (pidB: string) => {
    if (!selectedPoet) return
    try {
      const r = await fetch('/api/v1/poets/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poet_a_id: selectedPoet, poet_b_id: pidB }),
      })
      const d = await r.json()
      setEncounterProb(d.probability)

      // 获取两位诗人的最新轨迹坐标做连线
      const [ra, rb] = await Promise.all([
        fetch(`/api/v1/poets/${selectedPoet}/trajectory`).then(r=>r.json()),
        fetch(`/api/v1/poets/${pidB}/trajectory`).then(r=>r.json()),
      ])
      const evtsA = (ra.events || []).filter((e:TrajectoryEvent) => e.wgs84_lon && e.wgs84_lat)
      const evtsB = (rb.events || []).filter((e:TrajectoryEvent) => e.wgs84_lon && e.wgs84_lat)
      if (evtsA.length && evtsB.length) {
        const lastA = evtsA[Math.floor(evtsA.length/2)]
        const lastB = evtsB[Math.floor(evtsB.length/2)]
        setEncounterLines([{
          from: [lastA.wgs84_lat!, lastA.wgs84_lon!],
          to: [lastB.wgs84_lat!, lastB.wgs84_lon!],
          probability: d.probability,
        }])
      }
    } catch {}
  }, [selectedPoet])

  const toggleHeatmap = useCallback(async () => {
    setShowHeatmap(v => !v)
    if (!showHeatmap) { try { const d=await getHeatmap(); setHeatmap(d.points||[]) } catch {} }
    else setHeatmap([])
  }, [showHeatmap])

  const validEvents = trajectory.filter(e => e.wgs84_lon && e.wgs84_lat)
  const eventTypes = [...new Set(trajectory.map(e => e.event_type))]
  const poetName = (id: string) => poets.find(p => p.poet_id === id)?.name || id

  return (
    <div style={S.container}>
      <div style={S.sidebar}>
        <div style={S.header}>
          <h1 style={S.h1}>诗词时空</h1>
          <div style={S.hsub}>中国古诗词文化互动平台 | 学术工具端</div>
        </div>

        {/* 诗人选择 */}
        <div style={S.panel}>
          <div style={S.ptitle}>选择诗人</div>
          <div>{poets.map(p => (
            <button key={p.poet_id} style={selectedPoet===p.poet_id?S.btnA:S.btn}
              onClick={()=>handleSelectPoet(p.poet_id)}>{p.name}</button>
          ))}</div>
        </div>

        {/* 时间轴 + 动画 */}
        {trajectory.length > 0 && (
          <div style={S.panel}>
            <div style={S.ptitle}>
              时间轴
              <span style={{float:'right',fontWeight:400,fontSize:11,color:'#888'}}>
                {animIndex !== undefined ? trajectory[animIndex]?.event_year : trajectory[0]?.event_year}
                {' ~ '}{trajectory[trajectory.length-1]?.event_year}
              </span>
            </div>
            <input type="range" style={S.slider} min={0} max={Math.max(0, trajectory.length-1)}
              value={animIndex ?? 0}
              onChange={e => { setAnimIndex(parseInt(e.target.value)); setIsPlaying(false) }} />
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <button style={S.animBtn} onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
              <button style={{...S.animBtn,background:speed===1?'#e8e0d4':'#fff'}} onClick={()=>setSpeed(1)}>1×</button>
              <button style={{...S.animBtn,background:speed===2?'#e8e0d4':'#fff'}} onClick={()=>setSpeed(2)}>2×</button>
              <button style={{...S.animBtn,background:speed===4?'#e8e0d4':'#fff'}} onClick={()=>setSpeed(4)}>4×</button>
              <span style={{fontSize:11,color:'#888'}}>{animIndex !== undefined ? animIndex+1 : 0}/{trajectory.length}</span>
            </div>
          </div>
        )}

        {/* 交游概率 */}
        {selectedPoet && (
          <div style={S.panel}>
            <div style={S.ptitle}>交游概率</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
              {poets.filter(p => p.poet_id !== selectedPoet).slice(0, 8).map(p => (
                <button key={p.poet_id} style={poetB===p.poet_id?S.btnA:S.btn}
                  onClick={()=>{setPoetB(p.poet_id);calcEncounter(p.poet_id)}}>{p.name}</button>
              ))}
            </div>
            {encounterProb !== null && (
              <div style={{fontSize:13,color:'#5B4A3E',fontWeight:600}}>
                {poetName(selectedPoet)} ↔ {poetName(poetB||'')}：{(encounterProb*100).toFixed(1)}%
              </div>
            )}
          </div>
        )}

        {/* 图层 */}
        <div style={S.panel}>
          <div style={S.ptitle}>图层</div>
          <div style={S.layerItem}><input type="checkbox" defaultChecked readOnly /><span>地名</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={!!selectedPoet} readOnly /><span>轨迹 {selectedPoet?'✓':''}</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={showHeatmap} onChange={toggleHeatmap} /><span>热力</span></div>
          <div style={S.layerItem}><input type="checkbox" checked={encounterLines.length>0} readOnly /><span>交游 {encounterLines.length>0?'✓':''}</span></div>
        </div>

        {/* 统计 */}
        <div style={{...S.panel, flex:1, borderBottom:'none', overflow:'auto'}}>
          <div style={S.ptitle}>诗人档案</div>
          {trajectory.length > 0 ? (
            <div style={{fontSize:12,lineHeight:1.8}}>
              <div>轨迹事件: {trajectory.length} 条</div>
              <div>有效点位: {validEvents.length} 个</div>
              <div>事件类型: {eventTypes.join(' · ')}</div>
              <div style={{marginTop:4}}>类型分布:</div>
              {eventTypes.map(t => (
                <div key={t} style={S.chip}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:EVENT_COLORS[t]||'#999',display:'inline-block'}}/>
                  {t}: {trajectory.filter(e => e.event_type === t).length}
                </div>
              ))}
            </div>
          ) : <div style={{fontSize:12,color:'#aaa'}}>选择诗人查看轨迹</div>}
        </div>

        <div style={S.statusBar}>
          <span>诗人 {poets.length} · 轨迹 {trajectory.length} · 热力 {heatmap.length}</span>
        </div>
      </div>

      <div style={S.main}>
        <PoetryMap trajectory={trajectory} heatmap={showHeatmap?heatmap:[]}
          animIndex={animIndex !== undefined && isPlaying ? animIndex : undefined}
          encounterLines={encounterLines} />
      </div>
    </div>
  )
}
