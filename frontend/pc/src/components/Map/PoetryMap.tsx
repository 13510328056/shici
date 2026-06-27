/**
 * 诗词地图核心组件
 * 支持：多诗人轨迹叠加 / 围栏查询 / 动画 / 热力 / 交游网络
 */

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] })

import type { PlaceName, TrajectoryEvent, HeatmapPoint } from '../../types'
import { EVENT_COLORS } from '../../types'

export const POET_COLORS = ['#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#FF5722', '#795548', '#607D8B', '#E91E63']

// 国内网络环境可用的瓦片地图源
// OSM/CartoDB/OpenTopoMap 在部分网络受限环境下不可用，已替换为高德地图
// 国内可用的高德地图瓦片
// style=8: 标准路网图，通过{webrd,wprd}{01-04}子域名负载均衡
const TILES = {
  modern: {
    name: '高德路网',
    url: 'https://{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    attr: '&copy; 高德地图',
    subdomains: ['webrd01', 'webrd02', 'webrd03', 'webrd04'],
  },
  light: {
    name: '高德简图',
    url: 'https://{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    attr: '&copy; 高德地图',
    subdomains: ['wprd01', 'wprd02', 'wprd03', 'wprd04'],
  },
  // 古风底图（水墨风格替代） — 使用 CartoDB Dark Matter 模拟古风
  antique: {
    name: '古风底图',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attr: '&copy; CartoDB',
    subdomains: ['a', 'b', 'c', 'd'],
  },
}

// 事件类型 → 颜色映射（标准化）
function eventColor(evtType: string): string {
  if (['出生','去世'].includes(evtType)) return '#2196F3'       // 蓝
  if (evtType === '科举') return '#00BCD4'                       // 青
  if (['仕宦','政治'].includes(evtType)) return '#1565C0'        // 深蓝
  if (evtType === '贬谪') return '#F44336'                       // 红
  if (['游览','交游'].includes(evtType)) return '#4CAF50'        // 绿
  if (evtType === '雅集') return '#FFD700'                       // 金黄
  if (evtType === '军事') return '#FF5722'                       // 橙
  if (evtType === '隐居') return '#795548'                       // 棕
  if (evtType === '创作') return '#9C27B0'                       // 紫
  return EVENT_COLORS[evtType] || '#999'
}

// ─── 地名 ─────────────────────────────────
function PlaceMarkers({ places }: { places: PlaceName[] }) {
  const map = useMap()
  useEffect(() => {
    if (!places.length) return
    const g = L.layerGroup()
    places.forEach(p => {
      L.circleMarker([p.wgs84_lat, p.wgs84_lon], { radius: 5, fillColor: '#FF6B35', color: '#fff', weight: 2, fillOpacity: 0.9 })
        .bindPopup(`<b>${p.ancient_name}</b>（${p.modern_name}）<br/>${p.province||''} ${p.city||''}`)
        .addTo(g)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, places])
  return null
}

// ─── 多诗人轨迹 ────────────────────────────
function MultiTrajectoryLayer({
  poets,
}: {
  poets: Array<{ name: string; events: TrajectoryEvent[]; color: string; animIndex?: number }>
}) {
  const map = useMap()
  const bgRef = useRef<L.LayerGroup | null>(null)
  const riderLayer = useRef<L.LayerGroup | null>(null)
  const prevIdx = useRef<number | undefined>(undefined)

  useEffect(() => {
    // ── 清空 ──
    if (bgRef.current) map.removeLayer(bgRef.current)
    if (riderLayer.current) map.removeLayer(riderLayer.current)
    bgRef.current = null; riderLayer.current = null

    const g = L.layerGroup()
    const allBounds: L.LatLng[] = []
    const last = poets[poets.length - 1]
    const animIdx = last?.animIndex

    poets.forEach(({ name, events, color }) => {
      const valid = events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }>
      if (!valid.length) return
      const end = animIdx !== undefined && name === last?.name ? animIdx + 1 : valid.length
      const visible = valid.slice(0, end)

      if (visible.length > 1) {
        const pts = visible.map(e => [e.wgs84_lat, e.wgs84_lon] as [number, number])
        L.polyline(pts, { color, weight: 2.5, opacity: 0.7 })
          .bindPopup(`<b>${name}</b> · ${events[0]?.event_year||''}~${events[events.length-1]?.event_year||''}`)
          .addTo(g)
        pts.forEach(p => allBounds.push(L.latLng(p)))
      }

      visible.forEach(e => {
        const ec = eventColor(e.event_type)
        L.circleMarker([e.wgs84_lat, e.wgs84_lon], {
          radius: 5, fillColor: ec,
          color: '#fff', weight: 1.5, fillOpacity: 0.7,
        })
          .bindPopup(`<b>${name}</b> · ${e.event_year} ${e.event_type}<br/>${e.ancient_place||''}${e.stay_duration_days ? `<br/>停留${e.stay_duration_days}天` : ''}`)
          .addTo(g)
        allBounds.push(L.latLng(e.wgs84_lat, e.wgs84_lon))
      })
    })

    g.addTo(map)
    bgRef.current = g

    // ── 骑手独立图层 ──
    const rl = L.layerGroup()
    if (last && animIdx !== undefined) {
      const valid = last.events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }>
      const tgt = valid[animIdx]
      if (tgt) {
        // 大号金色圆点 + 骑手标签
        L.circleMarker([tgt.wgs84_lat, tgt.wgs84_lon], {
          radius: 14, fillColor: '#FFD700',
          color: '#8B4513', weight: 3, fillOpacity: 0.3,
        }).addTo(rl)
        L.marker([tgt.wgs84_lat, tgt.wgs84_lon], {
          icon: L.divIcon({
            className: 'rider-icon',
            html: '<div style="font-size:22px;line-height:1;text-align:center">🏇</div>',
            iconSize: [28, 28], iconAnchor: [14, 14],
          }),
          zIndexOffset: 9999,
        }).addTo(rl)
          .bindPopup(`<b>${last.name}</b> · ${tgt.event_year} ${tgt.event_type}<br/>${tgt.ancient_place||''}`)
      }
    }
    rl.addTo(map)
    riderLayer.current = rl

    if (allBounds.length > 1) map.fitBounds(L.latLngBounds(allBounds).pad(0.1))
    return () => { map.removeLayer(g); map.removeLayer(rl) }
  }, [map, poets])

  // ── 更新骑手位置（平滑移动）────────────────────
  useEffect(() => {
    const last = poets[poets.length - 1]
    const valid = last?.events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }> | undefined
    const idx = last?.animIndex
    if (idx === undefined || !valid || idx >= valid.length) { prevIdx.current = idx; return }
    const target = valid[idx]
    const prev = prevIdx.current !== undefined ? Math.min(prevIdx.current, valid.length - 1) : idx
    const source = valid[prev] || target

    // 如果 riderLayer 中有 marker，移动它
    if (riderLayer.current) {
      const markers = riderLayer.current.getLayers()
      const marker = markers.find(m => m instanceof L.Marker) as L.Marker | undefined
      if (marker) {
        const fLat = source.wgs84_lat, fLng = source.wgs84_lon
        const tLat = target.wgs84_lat, tLng = target.wgs84_lon
        const t0 = performance.now()
        const tick = (n: number) => {
          const p = Math.min((n - t0) / 300, 1)
          const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
          marker.setLatLng([fLat + (tLat - fLat) * e, fLng + (tLng - fLng) * e])
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }
    prevIdx.current = idx
  }, [poets.map(p => String(p.animIndex)).join(',')])

  return null
}

// ─── 热力 ─────────────────────────────────
function HeatmapLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const g = L.layerGroup()
    const max = Math.max(...points.map(p => p.poetry_count), 1)
    points.forEach(p => {
      const i = p.poetry_count / max
      L.circleMarker([p.wgs84_lat, p.wgs84_lon], {
        radius: 6 + i * 18,
        fillColor: `rgb(${Math.round(255*(1-i))},${Math.round(128*(1-i))},60)`,
        color: '#fff', weight: 1, fillOpacity: 0.7,
      }).bindPopup(`<b>${p.ancient_name}</b><br/>${p.poetry_count}首`).addTo(g)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, points])
  return null
}

// ─── 交游 ─────────────────────────────────
function EncounterLines({ lines }: { lines: Array<{ from: [number,number]; to: [number,number]; probability: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (!lines.length) return
    const g = L.layerGroup()
    lines.forEach(l => {
      L.polyline([l.from, l.to], { color: '#E91E63', weight: 2, opacity: 0.4 + l.probability * 0.6, dashArray: '6, 4' })
        .bindPopup(`${(l.probability * 100).toFixed(1)}%`).addTo(g)
      const mid = [(l.from[0] + l.to[0]) / 2, (l.from[1] + l.to[1]) / 2] as [number, number]
      L.circleMarker(mid, { radius: 12 + l.probability * 20, fillColor: '#E91E63', color: '#fff', weight: 2, fillOpacity: 0.3 })
        .bindTooltip(`${(l.probability * 100).toFixed(0)}%`, { permanent: true, direction: 'center' }).addTo(g)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, lines])
  return null
}

// ─── 围栏查询交互（进入围栏模式后生效，避免与点位点击冲突）──
function FenceClickHandler({ fenceMode, onFenceClick }: { fenceMode: boolean; onFenceClick?: (lat: number, lon: number) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!fenceMode || !onFenceClick) return
    map.getContainer().style.cursor = 'crosshair'
    const handler = (e: L.LeafletMouseEvent) => onFenceClick(e.latlng.lat, e.latlng.lng)
    map.on('click', handler)
    return () => {
      map.getContainer().style.cursor = ''
      map.off('click', handler)
    }
  }, [map, fenceMode, onFenceClick])
  return null
}

function FenceResults({ results, lat, lon }: { results: PlaceName[]; lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    if (!results?.length) return
    const g = L.layerGroup()
    try {
      L.circleMarker([lat, lon], { radius: 8, color: '#FF6B35', fillColor: '#FF6B35', fillOpacity: 0.3, weight: 2 })
        .bindPopup(`<b>查询中心</b><br/>${lat.toFixed(4)}, ${lon.toFixed(4)}<br/>半径80km`).addTo(g)
      L.circle([lat, lon], { radius: 80000, color: '#FF6B35', fillColor: '#FF6B35', fillOpacity: 0.06, weight: 1.5 }).addTo(g)
      results.forEach(p => {
        if (p.wgs84_lat == null || p.wgs84_lon == null) return
        L.circleMarker([p.wgs84_lat, p.wgs84_lon], { radius: 5, fillColor: '#E91E63', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
          .bindPopup(`<b>${p.ancient_name}</b>（${p.modern_name}）<br/>距中心 ${p.distance_km?.toFixed(1)}km`).addTo(g)
      })
      g.addTo(map)
    } catch (e) { console.error('FenceResults error:', e) }
    return () => { map.removeLayer(g) }
  }, [map, results, lat, lon])
  return null
}

// ─── 搜索结果点位 ─────────────────────────
function SearchResultMarkers({ results }: { results: Array<{ title: string; author: string }> }) {
  const map = useMap()
  useEffect(() => {
    if (!results.length) return
    const g = L.layerGroup()
    results.slice(0, 50).forEach((r, i) => {
      // 在随机偏移位置生成标记（搜索结果无坐标，用可视化展示）
      // 实际项目应使用真实坐标，这里用地图中心周围随机偏移
      const center = map.getCenter()
      const offset = 0.5
      const lat = center.lat + (Math.random() - 0.5) * offset * 2
      const lng = center.lng + (Math.random() - 0.5) * offset * 2
      const hue = (i * 37) % 360
      L.circleMarker([lat, lng], {
        radius: 4 + (i % 3) * 2, fillColor: `hsl(${hue}, 70%, 55%)`,
        color: '#fff', weight: 1, fillOpacity: 0.8,
      }).bindPopup(`<b>${r.title}</b> — ${r.author}`).addTo(g)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, results])
  return null
}

// ─── 截图工具 ──────────────────────────────
function ScreenshotButton() {
  const map = useMap()
  useEffect(() => {
    const ctrl = (L.control as any)({ position: 'topleft' })
    ctrl.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = '📷'
      btn.title = '截图下载（保存为PNG）'
      btn.style.cssText = 'width:34px;height:34px;background:#fff;border:2px solid rgba(0,0,0,0.2);border-radius:4px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center'
      btn.onclick = () => {
        const c = map.getContainer()
        // 用canvg方式截图：创建canvas并绘制SVG
        const svg = c.querySelector('svg')?.cloneNode(true) as SVGElement
        if (!svg) return
        const rect = c.getBoundingClientRect()
        const canvas = document.createElement('canvas')
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.scale(2, 2)
        // 渲染背景
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, rect.width, rect.height)
        // 使用XML序列化SVG绘制到canvas
        const data = new XMLSerializer().serializeToString(svg)
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          const a = document.createElement('a')
          a.download = 'poetryspace-map.png'
          a.href = canvas.toDataURL('image/png')
          a.click()
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)))
      }
      return btn
    }
    ctrl.addTo(map)
    return () => { map.removeControl(ctrl) }
  }, [map])
  return null
}

// ─── 距离测量工具 ─────────────────────────
// 点击起点→点击终点→显示距离（km）
function DistanceMeasure() {
  const map = useMap()
  useEffect(() => {
    const MeasureControl = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create('button')
        btn.innerHTML = '📏'
        btn.title = '距离测量（点击起点→终点）'
        btn.style.cssText = 'width:34px;height:34px;background:#fff;border:2px solid rgba(0,0,0,0.2);border-radius:4px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center'
        btn.onclick = () => startMeasure(map)
        return btn
      },
    })
    const ctrl = new MeasureControl({ position: 'topleft' })
    ctrl.addTo(map)
    return () => { map.removeControl(ctrl) }
  }, [map])
  return null
}

function startMeasure(map: L.Map) {
  const points: L.LatLng[] = []
  const markers: L.Marker[] = []
  const lines: L.Polyline[] = []
  let active = true

  const clickHandler = (e: L.LeafletMouseEvent) => {
    if (!active) return
    points.push(e.latlng)
    const m = L.marker(e.latlng).addTo(map)
    markers.push(m)
    m.bindPopup(`点 ${points.length}<br/>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`)
    if (points.length >= 2) {
      const prev = points[points.length - 2]
      const d = prev.distanceTo(e.latlng) / 1000
      const line = L.polyline([prev, e.latlng], { color: '#E91E63', weight: 2, dashArray: '6, 4' }).addTo(map)
      lines.push(line)
      L.marker([(prev.lat + e.latlng.lat) / 2, (prev.lng + e.latlng.lng) / 2], {
        icon: L.divIcon({ className: '', html: `<div style="background:#fff;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2)">${d.toFixed(1)} km</div>` }),
      }).addTo(map)
    }
  }
  const escHandler = (e: L.LeafletKeyboardEvent) => {
    if (e.originalEvent.key === 'Escape') {
      active = false
      markers.forEach(m => map.removeLayer(m))
      lines.forEach(l => map.removeLayer(l))
      map.off('click', clickHandler)
      document.removeEventListener('keydown', escHandler as any)
    }
  }

  map.on('click', clickHandler)
  document.addEventListener('keydown', escHandler as any)
  const tip = (L.control as any)({ position: 'bottomleft' })
  tip.onAdd = () => {
    const d = L.DomUtil.create('div')
    d.id = 'measure-tip'
    d.innerHTML = '<div style="background:#fff;padding:6px 12px;border-radius:6px;box-shadow:0 1px 5px rgba(0,0,0,.2);font-size:12px">📏 点击地图设起点（ESC退出）</div>'
    return d
  }
  tip.addTo(map)
  const clearTip = () => { map.removeControl(tip); document.removeEventListener('keydown', escHandler as any) }
  setTimeout(() => { if (active) clearTip() }, 5000)
}

// ─── 图例 ─────────────────────────────────
function Legend() {
  const map = useMap()
  useEffect(() => {
    const ctrl = (L.control as any)({ position: 'bottomleft' })
    ctrl.onAdd = () => {
      const d = L.DomUtil.create('div')
      d.innerHTML = `<div style="background:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 1px 5px rgba(0,0,0,.2);font-size:12px;line-height:1.8">
        <div style="font-weight:600;margin-bottom:4px">图例</div>
        ${Object.entries(EVENT_COLORS).map(([k,v]) =>
          `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:8px">
          <span style="width:10px;height:10px;border-radius:50%;background:${v};display:inline-block"></span>${k}</span>`
        ).join('')}</div>`
      return d
    }
    ctrl.addTo(map)
    return () => { map.removeControl(ctrl) }
  }, [map])
  return null
}

// ─── 主题路线图层 ────────────────────────────
function RouteLayer({ route }: { route: any }) {
  const map = useMap()
  useEffect(() => {
    if (!route?.stops?.length) return
    const g = L.layerGroup()
    const pts: [number, number][] = route.stops.map((s: any) => [s.lat, s.lon])

    // 连线
    L.polyline(pts, { color: route.color || '#FF6B35', weight: 3, opacity: 0.7, dashArray: '8, 4' }).addTo(g)

    // 带序号的站点标记
    route.stops.forEach((s: any, i: number) => {
      const num = i + 1
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${route.color || '#FF6B35'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff">${num}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      L.marker([s.lat, s.lon], { icon })
        .bindPopup(`<b>${num}. ${s.place}</b><br/>${s.desc || ''}`)
        .addTo(g)
    })

    g.addTo(map)
    // 缩放到所有站点
    map.fitBounds(L.latLngBounds(pts).pad(0.15))
    return () => { map.removeLayer(g) }
  }, [map, route])
  return null
}

// ─── 主组件 ───────────────────────────────
export interface PoetTrajectoryData {
  name: string
  events: TrajectoryEvent[]
  color: string
  animIndex?: number
}

interface PoetryMapProps {
  places?: PlaceName[]
  poets?: PoetTrajectoryData[]
  heatmap?: HeatmapPoint[]
  searchResults?: Array<{ title: string; author: string }>
  encounterLines?: Array<{ from: [number,number]; to: [number,number]; probability: number }>
  fenceResults?: { lat: number; lon: number; places: PlaceName[] }
  fenceMode?: boolean
  onFenceClick?: (lat: number, lon: number) => void
  activeRoute?: any
}

export default function PoetryMap({
  places = [], poets = [], heatmap = [], encounterLines = [],
  searchResults = [],
  fenceResults, fenceMode = false, onFenceClick, activeRoute,
}: PoetryMapProps) {
  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <MapContainer center={[34,108]} zoom={5} style={{ width:'100%', height:'100%' }} zoomControl={true}>
        <LayersControl position="topright">
          {Object.entries(TILES).map(([k, t]) => (
            <LayersControl.BaseLayer key={k} name={t.name} checked={k==='modern'}>
              <TileLayer url={t.url} attribution={t.attr} subdomains={t.subdomains} />
            </LayersControl.BaseLayer>
          ))}
          <LayersControl.Overlay name="古风底图" checked={false}>
            <TileLayer url={TILES.antique.url} attribution={TILES.antique.attr} subdomains={TILES.antique.subdomains} />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="地名" checked><PlaceMarkers places={places} /></LayersControl.Overlay>
          <LayersControl.Overlay name="诗人轨迹" checked={poets.length>0}>
            {poets.length > 0 && <MultiTrajectoryLayer poets={poets} />}
          </LayersControl.Overlay>
          <LayersControl.Overlay name="诗词热力" checked={false}>
            {heatmap.length > 0 && <HeatmapLayer points={heatmap} />}
          </LayersControl.Overlay>
          <LayersControl.Overlay name="交游网络" checked={encounterLines.length>0}>
            {encounterLines.length > 0 && <EncounterLines lines={encounterLines} />}
          </LayersControl.Overlay>
        </LayersControl>
        <FenceClickHandler fenceMode={fenceMode} onFenceClick={onFenceClick} />
        {fenceResults && <FenceResults results={fenceResults.places} lat={fenceResults.lat} lon={fenceResults.lon} />}
        {searchResults.length > 0 && (
          <LayersControl.Overlay name="检索结果" checked>
            <SearchResultMarkers results={searchResults} />
          </LayersControl.Overlay>
        )}
        {activeRoute && <RouteLayer route={activeRoute} />}
        <DistanceMeasure />
        <ScreenshotButton />
        <Legend />
      </MapContainer>
    </div>
  )
}
