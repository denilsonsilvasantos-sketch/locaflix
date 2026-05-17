import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Property } from '../types'
import { formatCurrency } from '../lib/utils'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;background:#E50914;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -22],
  tooltipAnchor: [5, -16],
})

interface MapViewProps {
  height?: string | number
}

export function MapView({ height = '500px' }: MapViewProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  const containerStyle = { height: typeof height === 'number' ? `${height}px` : height, width: '100%' }

  useEffect(() => {
    supabase
      .from('properties')
      .select('id, name, city, state, photos, price_per_night, latitude, longitude')
      .eq('status', 'ATIVO')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(500)
      .then(({ data }) => {
        setProperties((data ?? []) as Property[])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#1A1A1A] rounded-xl" style={containerStyle}>
        <div className="w-8 h-8 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-[#555] bg-[#1A1A1A] rounded-xl" style={containerStyle}>
        <p className="text-sm">Nenhum imóvel com coordenadas cadastradas.</p>
        <p className="text-xs text-[#444]">Adicione latitude e longitude ao cadastrar imóveis.</p>
      </div>
    )
  }

  return (
    <div style={containerStyle} className="rounded-xl overflow-hidden">
      <MapContainer
        center={[-14.235, -51.925]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties.map(p =>
          p.latitude && p.longitude ? (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={PIN_ICON}>
              <Popup>
                <div style={{ width: 180, fontFamily: 'sans-serif' }}>
                  {p.photos?.[0] && (
                    <img
                      src={p.photos[0]}
                      alt={p.name}
                      style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 7, display: 'block' }}
                    />
                  )}
                  <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 2px', lineHeight: 1.3, color: '#111' }}>{p.name}</p>
                  <p style={{ color: '#888', fontSize: 11, margin: '0 0 5px' }}>{p.city}, {p.state}</p>
                  <p style={{ color: '#555', fontSize: 11, margin: '0 0 9px' }}>
                    A partir de <strong style={{ color: '#111' }}>{formatCurrency(p.price_per_night)}</strong>
                  </p>
                  <Link
                    to={`/imovel/${p.id}`}
                    style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      background: '#e50914', color: '#fff', borderRadius: 6,
                      padding: '7px 0', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    Ver imóvel
                  </Link>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  )
}
