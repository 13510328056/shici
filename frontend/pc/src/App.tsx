import { useState, useEffect, useCallback } from 'react'
import PoetryMap from './components/Map/PoetryMap'
import type { TrajectoryEvent, HeatmapPoint } from './types'
import { getHeatmap } from './api'

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', width: '100vw', height: '100vh', fontFamily: 'serif', color: '#2c2c2c', overflow: 'hidden' },
  sidebar: { width: 320, minWidth: 320, height: '100vh', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', background: '#fafaf8' },
  header: { padding: '16px 16px 12px', borderBottom: '1px solid #e8e4de', background: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#3a3a3a', margin: 0 },
  headerSub: { fontSize: 11, color: '#888', marginTop: 2 },
  panel: { padding: '10px 16px', borderBottom: '1px solid #e8e4de' },
  panelTitle: { fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' },
  btn: { display: 'inline-block', padding: '3px 10px', margin: '3px', borderRadius: 12, border: '1px solid #d0cdc4', background: '#fff', fontSize: 12, cursor: 'pointer' },
  btnActive: { display: 'inline-block', padding: '3px 10px', margin: '3px', borderRadius: 12, border: 'none', background: '#5B4A3E', fontSize: 12, cursor: 'pointer', color: '#fff' },
  layerItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12 },
  statusBar: { height: 28, borderTop: '1px solid #e8e4de', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 11, color: '#888', background: '#fff' },
  mainArea: { flex: 1, position: 'relative' as const },
}

export default function App() {
  const [poets, setPoets] = useState<Array<{poet_id:string;name:string;dynasty:string}>>([])
  const [selectedPoet, setSelectedPoet] = useState<string|null>(null)
  const [trajectory, setTrajectory] = useState<TrajectoryEvent[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/v1/poets').then(r=>r.json()).then(d=>setPoets(d.poets||[])).catch(()=>{})
  }, [])

  const handleSelectPoet = useCallback(async (pid: string) => {
    if (selectedPoet === pid) { setSelectedPoet(null); setTrajectory([]); return }
    setSelectedPoet(pid); setLoading(true)
    try {
      const r = await fetch(`/api/v1/poets/${pid}/trajectory`)
      setTrajectory((await r.json()).events || [])
    } catch { setTrajectory([]) }
    setLoading(false)
  }, [selectedPoet])

  const toggleHeatmap = useCallback(async () => {
    setShowHeatmap(v => !v)
    if (!showHeatmap) {
      try { const d=await getHeatmap(); setHeatmap(d.points||[]) } catch { setHeatmap([]) }
    } else { setHeatmap([]) }
  }, [showHeatmap])

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>诗词时空</h1>
          <div style={styles.headerSub}>中国古诗词文化互动平台 | PC 端</div>
        </div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>选择诗人</div>
          <div>{poets.map(p => (
            <button key={p.poet_id} style={selectedPoet===p.poet_id?styles.btnActive:styles.btn}
              onClick={()=>handleSelectPoet(p.poet_id)}>{p.name}</button>
          ))}</div>
        </div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>图层控制</div>
          <div style={styles.layerItem}><input type="checkbox" defaultChecked readOnly /><span>地名标注</span></div>
          <div style={styles.layerItem}><input type="checkbox" checked={!!selectedPoet} readOnly /><span>诗人轨迹 {selectedPoet?'(已激活)':'(请选诗人)'}</span></div>
          <div style={styles.layerItem}><input type="checkbox" checked={showHeatmap} onChange={toggleHeatmap} /><span>诗词热力</span></div>
        </div>
        <div style={{...styles.panel,flex:1,borderBottom:'none'}}>
          <div style={styles.panelTitle}>统计</div>
          {trajectory.length>0 ? (
            <div style={{fontSize:12,lineHeight:1.8}}>
              <div>事件: {trajectory.length} 条</div>
              <div>年份: {trajectory[0]?.event_year}~{trajectory[trajectory.length-1]?.event_year}</div>
            </div>
          ) : <div style={{fontSize:12,color:'#aaa'}}>选择诗人查看轨迹</div>}
        </div>
        <div style={styles.statusBar}>
          <span>诗人 {poets.length} | 轨迹 {trajectory.length} | 热力 {heatmap.length}</span>
        </div>
      </div>
      <div style={styles.mainArea}>
        <PoetryMap trajectory={trajectory} heatmap={showHeatmap?heatmap:[]} />
      </div>
    </div>
  )
}
