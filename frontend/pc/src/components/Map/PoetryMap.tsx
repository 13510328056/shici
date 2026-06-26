/**
 * 诗词地图核心组件
 * 需求 4.1：诗词时空可视化综合模块
 *
 * 功能：
 * - 多底图切换（现代/古地图/水墨）
 * - 地名点位渲染
 * - 诗人轨迹展示
 * - 图层管理
 */

import { useEffect, useState, useCallback } from 'react'
import {
  MapContainer, TileLayer, LayersControl, GeoJSON,
  Popup, useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// 修复 Leaflet 默认图标路径问题
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] })
L.Marker.prototype.options.icon = DefaultIcon

import type { PlaceName, TrajectoryEvent, HeatmapPoint } from '../../types'
import { EVENT_COLORS } from '../../types'

// ─── 底图配置 ──────────────────────────────────
const TILE_CONFIGS = {
  modern: {
    name: '现代地图',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  light: {
    name: '水墨淡彩',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
  },
  terrain: {
    name: '地形晕渲',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
}

// ─── 事件类型标记样式 ──────────────────────────
function getEventStyle(type: string) {
  const color = EVENT_COLORS[type] || '#999'
  return {
    radius: 8,
    fillColor: color,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
  }
}

// ─── 地名点位组件 ──────────────────────────────
function PlaceMarkers({ places }: { places: PlaceName[] }) {
  const map = useMap()

  useEffect(() => {
    if (!places.length) return
    const markers = L.layerGroup()
    places.forEach((p) => {
      const marker = L.circleMarker([p.wgs84_lat, p.wgs84_lon], {
        radius: 6, fillColor: '#FF6B35', color: '#fff', weight: 2, fillOpacity: 0.9,
      })
      marker.bindPopup(`
        <b>${p.ancient_name}</b>（${p.modern_name}）<br/>
        ${p.province || ''} ${p.city || ''}<br/>
        <small>级别: ${p.admin_level} | 坐标: ${p.wgs84_lon.toFixed(4)}, ${p.wgs84_lat.toFixed(4)}</small>
        ${p.distance_km ? `<br/><small>距离: ${p.distance_km.toFixed(1)} km</small>` : ''}
      `)
      markers.addLayer(marker)
    })
    markers.addTo(map)
    return () => { map.removeLayer(markers) }
  }, [map, places])

  return null
}

// ─── 诗人轨迹组件 ──────────────────────────────
function PoetTrajectoryLayer({ events, color }: { events: TrajectoryEvent[]; color?: string }) {
  const map = useMap()

  useEffect(() => {
    if (!events.length) return
    const layer = L.layerGroup()
    const validPoints = events.filter(e => e.wgs84_lon && e.wgs84_lat) as Array<
      TrajectoryEvent & { wgs84_lon: number; wgs84_lat: number }
    >

    // 轨迹线
    if (validPoints.length > 1) {
      const line = L.polyline(
        validPoints.map(e => [e.wgs84_lat, e.wgs84_lon]),
        { color: color || '#2196F3', weight: 2, opacity: 0.6, dashArray: '8, 4' },
      )
      line.bindPopup('诗人行迹路线')
      layer.addLayer(line)
    }

    // 事件标记
    validPoints.forEach((e) => {
      const style = getEventStyle(e.event_type)
      const marker = L.circleMarker([e.wgs84_lat, e.wgs84_lon], {
        ...style, color: color || style.color,
      })
      marker.bindPopup(`
        <b>${e.event_year}</b> — ${e.event_type}<br/>
        ${e.ancient_place || '未知地点'}<br/>
        ${e.stay_duration_days ? `停留: ${e.stay_duration_days} 天<br/>` : ''}
        <small>${e.source || ''}</small>
      `)
      layer.addLayer(marker)
    })

    layer.addTo(map)
    // 缩放到轨迹范围
    if (validPoints.length > 1) {
      map.fitBounds(layer.getBounds().pad(0.1))
    }
    return () => { map.removeLayer(layer) }
  }, [map, events, color])

  return null
}

// ─── 热力图层 ──────────────────────────────────
function HeatmapLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    const layer = L.layerGroup()

    const maxCount = Math.max(...points.map(p => p.poetry_count))
    points.forEach((p) => {
      const intensity = maxCount > 0 ? p.poetry_count / maxCount : 0.5
      const r = Math.round(255 * (1 - intensity))
      const g = Math.round(128 * (1 - intensity))
      const marker = L.circleMarker([p.wgs84_lat, p.wgs84_lon], {
        radius: 8 + intensity * 16,
        fillColor: `rgb(${r}, ${g}, 60)`,
        color: '#fff', weight: 1, fillOpacity: 0.7,
      })
      marker.bindPopup(`
        <b>${p.ancient_name}</b>（${p.modern_name}）<br/>
        诗词: ${p.poetry_count} 首<br/>
        ${p.province}
      `)
      layer.addLayer(marker)
    })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, points])

  return null
}

// ─── 主组件 ────────────────────────────────────
interface PoetryMapProps {
  places?: PlaceName[]
  trajectory?: TrajectoryEvent[]
  heatmap?: HeatmapPoint[]
  selectedPoet?: string
  center?: [number, number]
  zoom?: number
}

export default function PoetryMap({
  places = [],
  trajectory = [],
  heatmap = [],
  center = [34.0, 108.0],
  zoom = 5,
}: PoetryMapProps) {
  const [activeBaseMap, setActiveBaseMap] = useState('modern')

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        {/* 底图图层 */}
        <LayersControl position="topright">
          {Object.entries(TILE_CONFIGS).map(([key, cfg]) => (
            <LayersControl.BaseLayer
              key={key}
              name={cfg.name}
              checked={activeBaseMap === key}
            >
              <TileLayer url={cfg.url} attribution={cfg.attribution} />
            </LayersControl.BaseLayer>
          ))}
        </LayersControl>

        {/* 地名点位 */}
        {places.length > 0 && (
          <LayersControl.Overlay name="地名标注" checked>
            <PlaceMarkers places={places} />
          </LayersControl.Overlay>
        )}

        {/* 诗人轨迹 */}
        {trajectory.length > 0 && (
          <LayersControl.Overlay name="诗人轨迹" checked>
            <PoetTrajectoryLayer events={trajectory} color="#2196F3" />
          </LayersControl.Overlay>
        )}

        {/* 热力图 */}
        {heatmap.length > 0 && (
          <LayersControl.Overlay name="诗词热力" checked={false}>
            <HeatmapLayer points={heatmap} />
          </LayersControl.Overlay>
        )}
      </MapContainer>
    </div>
  )
}
