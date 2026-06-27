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
const RIDER_ICON = L.divIcon({
  className: '',
  html: '<div style="font-size:28px;line-height:1;text-align:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));animation:hop 0.6s ease-in-out infinite alternate">🏇</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
})

function MultiTrajectoryLayer({
  poets,
}: {
  poets: Array<{ name: string; events: TrajectoryEvent[]; color: string; animIndex?: number }>
}) {
  const map = useMap()
  const ref = useRef<L.LayerGroup | null>(null)

  // 注入 CSS 动画
  useEffect(() => {
    if (!document.getElementById('rider-anim')) {
      const style = document.createElement('style')
      style.id = 'rider-anim'
      style.textContent = '@keyframes hop{0%{transform:translateY(0)}100%{transform:translateY(-6px)}}'
      document.head.appendChild(style)
    }
  }, [])

  useEffect(() => {
    if (ref.current) map.removeLayer(ref.current)
    const g = L.layerGroup()
    const allBounds: L.LatLng[] = []

    poets.forEach(({ name, events, color, animIndex }) => {
      const valid = events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }>
      if (!valid.length) return
      const end = animIndex !== undefined ? animIndex + 1 : valid.length
      const visible = valid.slice(0, end)

      // 轨迹线
      if (visible.length > 1) {
        const pts = visible.map(e => [e.wgs84_lat, e.wgs84_lon] as [number, number])
        L.polyline(pts, { color, weight: 2.5, opacity: 0.7 })
          .bindPopup(`<b>${name}</b> · ${events[0]?.event_year||''}~${events[events.length-1]?.event_year||''}`)
          .addTo(g)
        pts.forEach(p => allBounds.push(L.latLng(p)))
      }

      // 事件标记（骑马小人动画）
      visible.forEach((e, i) => {
        const isCurrent = animIndex !== undefined && i === animIndex
        if (isCurrent && e.wgs84_lat && e.wgs84_lon) {
          // 当前帧：骑马小人
          L.marker([e.wgs84_lat, e.wgs84_lon], { icon: RIDER_ICON, zIndexOffset: 1000 })
            .bindPopup(`<b>${name}</b> · ${e.event_year} ${e.event_type}<br/>${e.ancient_place||''}`, { offset: [0, -20] })
            .addTo(g)
        } else {
          // 普通帧：圆点
          const evColor = EVENT_COLORS[e.event_type] || '#999'
          L.circleMarker([e.wgs84_lat, e.wgs84_lon], {
            radius: 6, fillColor: evColor,
            color: '#fff', weight: 1.5, fillOpacity: 0.9,
          })
            .bindPopup(`<b>${name}</b> · ${e.event_year} ${e.event_type}<br/>${e.ancient_place||''}${e.stay_duration_days ? `<br/>停留${e.stay_duration_days}天` : ''}`)
            .addTo(g)
        }
        allBounds.push(L.latLng(e.wgs84_lat, e.wgs84_lon))
      })
    })

    g.addTo(map)
    ref.current = g
    if (allBounds.length > 1) map.fitBounds(L.latLngBounds(allBounds).pad(0.1))
    return () => { map.removeLayer(g) }
  }, [map, poets])

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
}

export default function PoetryMap({
  places = [], poets = [], heatmap = [], encounterLines = [],
  searchResults = [],
  fenceResults, fenceMode = false, onFenceClick,
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
        <DistanceMeasure />
        <Legend />
      </MapContainer>
    </div>
  )
}
