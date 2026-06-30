import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface TrajPoint {
  event_year: string; ancient_place: string; event_type: string
  wgs84_lat: number; wgs84_lon: number
}

export default function PoetMap() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const [points, setPoints] = useState<TrajPoint[]>([])
  const [poetName, setPoetName] = useState('')

  useEffect(() => {
    if (!id) return
    // 获取诗人详情（用于显示名字）
    fetch(`/api/v1/poets/${id}/detail`).then(r => r.json()).then(d => {
      if (d.name) setPoetName(d.name)
    }).catch(() => {})

    // 获取轨迹
    fetch(`/api/v1/poets/${id}/trajectory`).then(r => r.json()).then(d => {
      const valid = (d.events || []).filter((e: any) => e.wgs84_lat && e.wgs84_lon)
      setPoints(valid)
    }).catch(() => {})
  }, [id])

  // 渲染地图
  useEffect(() => {
    if (!mapRef.current || points.length === 0 || mapInstance.current) return

    const map = L.map(mapRef.current).setView([34, 108], 5)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)
    mapInstance.current = map

    const pts: [number, number][] = []
    const bounds = L.latLngBounds([])

    points.forEach(p => {
      const latlng: [number, number] = [p.wgs84_lat, p.wgs84_lon]
      pts.push(latlng)
      bounds.extend(latlng)

      L.circleMarker(latlng, {
        radius: 6, fillColor: '#C23B22', color: '#fff', weight: 2, fillOpacity: 0.9,
      }).addTo(map)
        .bindPopup(`<b>${p.event_year}</b> ${p.event_type}<br/>${p.ancient_place || ''}`)
    })

    if (pts.length > 1) {
      L.polyline(pts, { color: '#C23B22', weight: 2, opacity: 0.6, dashArray: '6,4' }).addTo(map)
    }

    if (pts.length > 0) map.fitBounds(bounds.pad(0.15))

    return () => { map.remove(); mapInstance.current = null }
  }, [points])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#e5ddd0] flex items-center gap-3 flex-none">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-[#5B4A3E]">
          {poetName ? `${poetName} · 足迹地图` : '足迹地图'}
        </h1>
        <span className="text-[10px] text-gray-400">{points.length} 个足迹点</span>
      </div>

      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f5f0e8]/80">
            <div className="text-center">
              <div className="inline-block w-6 h-6 border-2 border-[#c23a3a] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-400 text-sm">加载足迹数据…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
