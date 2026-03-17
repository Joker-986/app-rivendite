import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, AlertTriangle, MapPinOff, MapPin, Store, Info } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface SearchResult {
  [key: string]: any;
}

interface MapViewProps {
  results: SearchResult[];
}

interface GeocodedResult extends SearchResult {
  lat: number;
  lon: number;
}

const MapBounds = ({ markers }: { markers: GeocodedResult[] }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, map]);
  return null;
};

export default function MapView({ results }: MapViewProps) {
  const [geocodedResults, setGeocodedResults] = useState<GeocodedResult[]>([]);
  const [notFoundResults, setNotFoundResults] = useState<SearchResult[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    let isMounted = true;
    
    const geocodeResults = async () => {
      if (!results || results.length === 0) {
        setGeocodedResults([]);
        setNotFoundResults([]);
        setGeocodingProgress({ current: 0, total: 0 });
        return;
      }

      setGeocodingProgress({ current: 0, total: results.length });
      const newGeocoded: GeocodedResult[] = [];
      const newNotFound: SearchResult[] = [];
      
      // Funzione che chiama il NOSTRO server invece di OpenStreetMap direttamente
      const fetchGeocodeFromBackend = async (addr: string) => {
        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: addr })
          });
          if (res.ok) {
            return await res.json();
          }
          return [];
        } catch (e) {
          return [];
        }
      };
      
      for (let i = 0; i < results.length; i++) {
        if (!isMounted) break;
        
        const res = results[i];
        const cleanIndirizzo = res['Indirizzo'].replace(/S\.N\.C\.|SNC/gi, '').trim();
        const address = `${cleanIndirizzo}, ${res['Comune']}, ${res['Prov.']}, Italy`;
        const fallbackAddress = `${res['Comune']}, ${res['Prov.']}, Italy`;
        
        try {
          // Pausa per non intasare il server
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 1100));
          
          let data = await fetchGeocodeFromBackend(address);

          // Fallback 1: Indirizzo originale se quello pulito fallisce
          if ((!data || data.length === 0) && cleanIndirizzo !== res['Indirizzo']) {
            data = await fetchGeocodeFromBackend(`${res['Indirizzo']}, ${res['Comune']}, ${res['Prov.']}, Italy`);
          }

          // Fallback 2: Solo Comune e Provincia
          if (!data || data.length === 0) {
            data = await fetchGeocodeFromBackend(fallbackAddress);
          }
          
          if (data && data.length > 0) {
            newGeocoded.push({
              ...res,
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon)
            });
            setGeocodedResults([...newGeocoded]);
          } else {
            newNotFound.push(res);
            setNotFoundResults([...newNotFound]);
          }
        } catch (error) {
          console.error("Geocoding error for address:", address, error);
          newNotFound.push(res);
          setNotFoundResults([...newNotFound]);
        }
        
        setGeocodingProgress(prev => ({ ...prev, current: i + 1 }));
      }
    };

    geocodeResults();

    return () => {
      isMounted = false;
    };
  }, [results]);

  if (!results || results.length === 0) return null;

  const isGeocoding = geocodingProgress.current < geocodingProgress.total;

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">Mappa Rivendite</h3>
        {isGeocoding && (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
            Geocoding: {geocodingProgress.current} / {geocodingProgress.total}
          </span>
        )}
      </div>
      
      <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 relative z-0">
        <MapContainer 
          center={[41.8719, 12.5674]} 
          zoom={6} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {geocodedResults.map((res, idx) => (
            <Marker key={idx} position={[res.lat, res.lon]}>
              <Popup className="custom-popup">
                <div className="p-2 min-w-[220px]">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      Riv. {res['Num. Rivendita']}
                    </span>
                    {res['Tipo Rivendita'] && (
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {res['Tipo Rivendita']}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm leading-tight">
                        {res['Comune']} ({res['Prov.']})
                      </div>
                      <div className="text-slate-600 text-xs mt-1 leading-relaxed">
                        {res['Indirizzo']}<br />
                        {res['CAP']} {res['Comune']}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=$${res.lat},${res.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 active:scale-95 text-brand-700 w-full py-3 px-6 rounded-xl text-sm font-bold transition-all no-underline shadow-sm"
                    >
                      <Navigation className="w-4 h-4" />
                      Naviga
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          <MapBounds markers={geocodedResults} />
        </MapContainer>
      </div>
      
      {notFoundResults.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-sm font-bold uppercase tracking-wider">Rivendite non localizzate ({notFoundResults.length})</h4>
            </div>
            {isGeocoding && (
              <span className="text-[10px] text-amber-600 animate-pulse font-medium">
                Ricerca in corso...
              </span>
            )}
          </div>
          <div className="space-y-2">
            {notFoundResults.map((res, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                  <MapPinOff className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      RIV. {res['Num. Rivendita']}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 truncate">{res['Comune']}</div>
                  <div className="text-xs text-slate-600 truncate">{res['Indirizzo']}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
