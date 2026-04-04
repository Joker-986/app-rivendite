import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, MapPinOff, AlertTriangle, Crosshair } from 'lucide-react';

const defaultIcon = L.icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapViewProps { results: any[]; }

// GESTIONE ZOOM: Si attiva solo al primo caricamento o su richiesta
const MapController = ({ markers, userLocation, forceUpdate }: { markers: any[], userLocation: any, forceUpdate: boolean }) => {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if ((markers.length > 0 && !hasCentered.current) || forceUpdate) {
      const points: L.LatLngExpression[] = markers.map(m => [m.lat, m.lon]);
      if (userLocation) points.push([userLocation.lat, userLocation.lon]);
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
        hasCentered.current = true;
      }
    }
  }, [markers.length, userLocation, forceUpdate]);
  return null;
};

export default function MapView({ results }: MapViewProps) {
  const [geocodedResults, setGeocodedResults] = useState<any[]>([]);
  const [notFoundResults, setNotFoundResults] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [forceCenter, setForceCenter] = useState(false);
  const isGeocoding = useRef(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(p => setUserLocation({ lat: p.coords.latitude, lon: p.coords.longitude }));
  }, []);

  useEffect(() => {
    if (isGeocoding.current || !results.length) return;
    isGeocoding.current = true;

    const run = async () => {
      const CACHE_KEY = 'tgest_geo_v30';
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const successful: any[] = [];
      const failed: any[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const id = res.uid || `${res['Comune']}_${res['Num. Rivendita']}`;
        
        if (cache[id]) {
          successful.push({ ...res, lat: cache[id].lat, lon: cache[id].lon });
        } else {
          try {
            // Pulizia indirizzo per migliorare precisione
            const cleanAddr = res['Indirizzo'].split('-')[0].split('(')[0].trim();
            const query = encodeURIComponent(`${cleanAddr}, ${res['Comune']}, ${res['Prov.']}, Italy`);
            
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&addressdetails=1`);
            const data = await response.json();

            if (data && data[0]) {
              const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
              cache[id] = coords;
              localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
              successful.push({ ...res, ...coords });
            } else {
              failed.push(res);
            }
            await new Promise(r => setTimeout(r, 1100));
          } catch (e) {
            failed.push(res);
          }
        }
        setProgress(i + 1);
        setGeocodedResults([...successful]);
        setNotFoundResults([...failed]);
      }
      isGeocoding.current = false;
    };
    run();
  }, [results]);

  const userIcon = L.divIcon({
    className: 'bg-transparent',
    html: `<div style="width:16px; height:16px; background:#4285F4; border:2px solid white; border-radius:50%; box-shadow:0 0 10px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16]
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <span className="text-[11px] font-black text-slate-500 uppercase">Progresso: {progress}/{results.length}</span>
        <button 
          onClick={() => { setForceCenter(true); setTimeout(() => setForceCenter(false), 500); }}
          className="p-2 bg-brand-50 text-brand-600 rounded-xl"
        ><Crosshair className="w-4 h-4" /></button>
      </div>

      <div className="h-[450px] w-full rounded-3xl overflow-hidden border-2 border-white shadow-xl relative z-0">
        <MapContainer center={[41.9, 12.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <MarkerClusterGroup>
            {geocodedResults.map((m, idx) => (
              <Marker key={idx} position={[m.lat, m.lon]}>
                <Popup>
                  <div className="p-1">
                    <p className="text-[10px] font-bold text-brand-600">Riv. {m['Num. Rivendita']}</p>
                    <p className="text-xs font-bold mb-2">{m['Comune']}</p>
                    <button onClick={() => window.location.href=`geo:0,0?q=${encodeURIComponent(m['Indirizzo']+', '+m['Comune'])}`} className="w-full bg-brand-600 text-white py-2 rounded-lg text-[10px] font-bold">NAVIGA</button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
          {userLocation && <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon} />}
          <MapController markers={geocodedResults} userLocation={userLocation} forceUpdate={forceCenter} />
        </MapContainer>
      </div>

      {/* LISTA NON LOCALIZZATI RIPRISTINATA */}
      {notFoundResults.length > 0 && (
        <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100">
          <div className="flex items-center gap-2 mb-3 text-orange-700">
            <AlertTriangle className="w-4 h-4" />
            <h4 className="text-xs font-black uppercase">Non Localizzate ({notFoundResults.length})</h4>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {notFoundResults.map((r, i) => (
              <div key={i} className="bg-white/60 p-2 rounded-xl text-[10px] font-bold text-slate-600 border border-orange-200/50">
                {r['Num. Rivendita']} - {r['Comune']} ({r['Indirizzo']})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
