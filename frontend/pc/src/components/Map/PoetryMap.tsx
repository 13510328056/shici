/**
 * 诗词地图核心组件 — 含轨迹动画 / 多底图 / 热力 / 图层管理
 * 需求 4.1：诗词时空可视化综合模块
 */

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] })

import type { PlaceName, TrajectoryEvent, HeatmapPoint } from '../../types'
import { EVENT_COLORS } from '../../types'

// ─── 底图 ─────────────────────────────────
const TILE_CONFIGS = {
  modern: { name: '现代地图', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  light: { name: '水墨淡彩', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB' },
  terrain: { name: '地形晕渲', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap' },
}

// ─── 地名点位 ─────────────────────────────
function PlaceMarkers({ places }: { places: PlaceName[] }) {
  const map = useMap()
  useEffect(() => {
    if (!places.length) return
    const g = L.layerGroup()
    places.forEach(p => {
      const m = L.circleMarker([p.wgs84_lat, p.wgs84_lon], { radius: 5, fillColor: '#FF6B35', color: '#fff', weight: 2, fillOpacity: 0.9 })
      m.bindPopup(`<b>${p.ancient_name}</b>（${p.modern_name}）<br/>${p.province||''} ${p.city||''}`)
      g.addLayer(m)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, places])
  return null
}

// ─── 诗人轨迹（静态+动画）───────────────────
function PoetTrajectoryLayer({
  events, color, animIndex,
}: {
  events: TrajectoryEvent[]; color?: string; animIndex?: number
}) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current)
    if (!events.length) return
    const valid = events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }>
    const g = L.layerGroup()
    const c = color || '#2196F3'

    // 显示到当前动画索引的轨迹
    const showTo = animIndex !== undefined ? animIndex + 1 : valid.length
    const visible = valid.slice(0, showTo)

    if (visible.length > 1) {
      const line = L.polyline(visible.map(e => [e.wgs84_lat, e.wgs84_lon] as [number, number]), {
        color: c, weight: 2.5, opacity: 0.7,
      })
      g.addLayer(line)
    }

    visible.forEach((e, i) => {
      const isCurrent = animIndex !== undefined && i === animIndex
      const style = EVENT_COLORS[e.event_type] || '#999'
      const m = L.circleMarker([e.wgs84_lat, e.wgs84_lon], {
        radius: isCurrent ? 10 : 7, fillColor: isCurrent ? '#FFD700' : style,
        color: isCurrent ? '#333' : '#fff', weight: isCurrent ? 3 : 2, fillOpacity: 0.9,
      })
      m.bindPopup(
        `<b>${e.event_year}</b> ${e.event_type}<br/>${e.ancient_place||''}` +
        (e.stay_duration_days ? `<br/>停留: ${e.stay_duration_days}天` : '')
      )
      g.addLayer(m)
    })

    g.addTo(map)
    layerRef.current = g

    // 首次加载缩放到范围
    if (animIndex === undefined && valid.length > 1) {
      map.fitBounds(L.latLngBounds(visible.map(e => [e.wgs84_lat, e.wgs84_lon] as [number, number])).pad(0.1))
    }
    return () => { map.removeLayer(g) }
  }, [map, events, color, animIndex])

  return null
}

// ─── 热力 ─────────────────────────────────
function HeatmapLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const g = L.layerGroup()
    const max = Math.max(...points.map(p => p.poetry_count))
    points.forEach(p => {
      const i = max > 0 ? p.poetry_count / max : 0.5
      const m = L.circleMarker([p.wgs84_lat, p.wgs84_lon], {
        radius: 6 + i * 18, fillColor: `rgb(${Math.round(255*(1-i))}, ${Math.round(128*(1-i))}, 60)`,
        color: '#fff', weight: 1, fillOpacity: 0.7,
      })
      m.bindPopup(`<b>${p.ancient_name}</b><br/>${p.poetry_count}首`)
      g.addLayer(m)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, points])
  return null
}

// ─── 交游连线 ─────────────────────────────
function EncounterLines({ lines }: { lines: Array<{ from: [number,number]; to: [number,number]; probability: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (!lines.length) return
    const g = L.layerGroup()
    lines.forEach(l => {
      const poly = L.polyline([l.from, l.to], {
        color: '#E91E63', weight: 2, opacity: 0.4 + l.probability * 0.6, dashArray: '6, 4',
      })
      poly.bindPopup(`交游概率: ${(l.probability * 100).toFixed(1)}%`)
      g.addLayer(poly)
      // 中点标注
      const mid = [(l.from[0] + l.to[0]) / 2, (l.from[1] + l.to[1]) / 2] as [number, number]
      const label = L.circleMarker(mid, {
        radius: 12 + l.probability * 20, fillColor: '#E91E63', color: '#fff', weight: 2, fillOpacity: 0.3,
      })
      label.bindTooltip(`${(l.probability * 100).toFixed(0)}%`, { permanent: true, direction: 'center', className: 'prob-label' })
      g.addLayer(label)
    })
    g.addTo(map)
    return () => { map.removeLayer(g) }
  }, [map, lines])
  return null
}

// ─── 图例 ─────────────────────────────────
function Legend() {
  const map = useMap()
  useEffect(() => {
    const ctrl = L.control({ position: 'bottomleft' })
    ctrl.onAdd = () => {
      const div = L.DomUtil.create('div')
      div.innerHTML = '<div style="background:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 1px 5px rgba(0,0,0,.2);font-size:12px;line-height:1.8">'
        + '<div style="font-weight:600;margin-bottom:4px">事件图例</div>'
        + Object.entries(EVENT_COLORS).map(([k, v]) =>
          `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:8px">` +
          `<span style="width:10px;height:10px;border-radius:50%;background:${v};display:inline-block"></span>${k}</span>`
        ).join('')
        + '</div>'
      return div
    }
    ctrl.addTo(map)
    return () => { map.removeControl(ctrl) }
  }, [map])
  return null
}

// ─── 主组件 ───────────────────────────────
interface PoetryMapProps {
  places?: PlaceName[]
  trajectory?: TrajectoryEvent[]
  heatmap?: HeatmapPoint[]
  animIndex?: number
  encounterLines?: Array<{ from: [number,number]; to: [number,number]; probability: number }>
}

export default function PoetryMap({
  places = [], trajectory = [], heatmap = [], animIndex, encounterLines = [],
}: PoetryMapProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer center={[34, 108]} zoom={5} style={{ width: '100%', height: '100%' }} zoomControl={true}>
        <LayersControl position="topright">
          {Object.entries(TILE_CONFIGS).map(([k, cfg]) => (
            <LayersControl.BaseLayer key={k} name={cfg.name} checked={k === 'modern'}>
              <TileLayer url={cfg.url} attribution={cfg.attribution} />
            </LayersControl.BaseLayer>
          ))}
          <LayersControl.Overlay name="地名" checked><PlaceMarkers places={places} /></LayersControl.Overlay>
          {trajectory.length > 0 && (
            <LayersControl.Overlay name="诗人轨迹" checked>
              <PoetTrajectoryLayer events={trajectory} animIndex={animIndex} />
            </LayersControl.Overlay>
          )}
          {heatmap.length > 0 && (
            <LayersControl.Overlay name="诗词热力" checked={false}>
              <HeatmapLayer points={heatmap} />
            </LayersControl.Overlay>
          )}
          {encounterLines.length > 0 && (
            <LayersControl.Overlay name="交游网络" checked>
              <EncounterLines lines={encounterLines} />
            </LayersControl.Overlay>
          )}
        </LayersControl>
        <Legend />
      </MapContainer>
    </div>
  )
}
