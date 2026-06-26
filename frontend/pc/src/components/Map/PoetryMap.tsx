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

export const POET_COLORS = ['#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#FF5722', '#795548']

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
function MultiTrajectoryLayer({
  poets,
}: {
  poets: Array<{ name: string; events: TrajectoryEvent[]; color: string; animIndex?: number }>
}) {
  const map = useMap()
  const ref = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (ref.current) map.removeLayer(ref.current)
    const g = L.layerGroup()
    const allBounds: L.LatLng[] = []

    poets.forEach(({ name, events, color, animIndex }) => {
      const valid = events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }>
      if (!valid.length) return
      const end = animIndex !== undefined ? animIndex + 1 : valid.length
      const visible = valid.slice(0, end)

      if (visible.length > 1) {
        const pts = visible.map(e => [e.wgs84_lat, e.wgs84_lon] as [number, number])
        L.polyline(pts, { color, weight: 2.5, opacity: 0.7 })
          .bindPopup(`<b>${name}</b> · ${events[0]?.event_year||''}~${events[events.length-1]?.event_year||''}`)
          .addTo(g)
        pts.forEach(p => allBounds.push(L.latLng(p)))
      }

      visible.forEach((e, i) => {
        const curr = animIndex !== undefined && i === animIndex
        const evColor = EVENT_COLORS[e.event_type] || '#999'
        L.circleMarker([e.wgs84_lat, e.wgs84_lon], {
          radius: curr ? 10 : 6, fillColor: curr ? '#FFD700' : evColor,
          color: curr ? '#333' : '#fff', weight: curr ? 3 : 1.5, fillOpacity: 0.9,
        })
          .bindPopup(`<b>${name}</b> · ${e.event_year} ${e.event_type}<br/>${e.ancient_place||''}${e.stay_duration_days ? `<br/>停留${e.stay_duration_days}天` : ''}`)
          .addTo(g)
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

// ─── 围栏查询交互 ──────────────────────────
function FenceClickHandler({ onFenceClick }: { onFenceClick?: (lat: number, lon: number) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!onFenceClick) return
    const handler = (e: L.LeafletMouseEvent) => onFenceClick(e.latlng.lat, e.latlng.lng)
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, onFenceClick])
  return null
}

function FenceResults({ results, lat, lon }: { results: PlaceName[]; lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    if (!results.length) return
    const g = L.layerGroup()
    // 中心标记
    L.circleMarker([lat, lon], { radius: 8, color: '#FF6B35', fillColor: '#FF6B35', fillOpacity: 0.3, weight: 2 })
      .bindPopup(`<b>查询中心</b><br/>${lat.toFixed(4)}, ${lon.toFixed(4)}<br/>半径80km`).addTo(g)
    // 围栏圆
    L.circle([lat, lon], { radius: 80000, color: '#FF6B35', fillColor: '#FF6B35', fillOpacity: 0.06, weight: 1.5 }).addTo(g)
    // 结果
    results.forEach(p => {
      L.circleMarker([p.wgs84_lat, p.wgs84_lon], { radius: 5, fillColor: '#E91E63', color: '#fff', weight: 1.5, fillOpacity: 0.9 })
        .bindPopup(`<b>${p.ancient_name}</b>（${p.modern_name}）<br/>距中心 ${p.distance_km?.toFixed(1)}km`).addTo(g)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, results, lat, lon])
  return null
}

// ─── 图例 ─────────────────────────────────
function Legend() {
  const map = useMap()
  useEffect(() => {
    const ctrl = L.control({ position: 'bottomleft' })
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
  encounterLines?: Array<{ from: [number,number]; to: [number,number]; probability: number }>
  fenceResults?: { lat: number; lon: number; places: PlaceName[] }
  onFenceClick?: (lat: number, lon: number) => void
}

export default function PoetryMap({
  places = [], poets = [], heatmap = [], encounterLines = [], fenceResults, onFenceClick,
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
        <FenceClickHandler onFenceClick={onFenceClick} />
        {fenceResults && <FenceResults results={fenceResults.places} lat={fenceResults.lat} lon={fenceResults.lon} />}
        <Legend />
      </MapContainer>
    </div>
  )
}
