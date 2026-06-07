'use client';

import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MapPin } from '@/lib/types';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 51.5074, lng: -0.1278 };

interface MapViewProps {
  pins: MapPin[];
}

export default function MapView({ pins }: MapViewProps) {
  const [selected, setSelected] = useState<MapPin | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const center = useMemo(() => {
    if (pins.length > 0) {
      const avgLat = pins.reduce((s, p) => s + p.latitude, 0) / pins.length;
      const avgLng = pins.reduce((s, p) => s + p.longitude, 0) / pins.length;
      return { lat: avgLat, lng: avgLng };
    }
    return defaultCenter;
  }, [pins]);

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    pins.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    if (pins.length > 0) map.fitBounds(bounds);
  }, [pins]);

  return (
    <div className="aspect-[4/3] w-full rounded-lg border border-slate-200 overflow-hidden">
      {!isLoaded ? (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          Loading map...
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={12}
          onLoad={onLoad}
        >
          {pins.map(pin => (
            <Marker
              key={pin.raia_id}
              position={{ lat: pin.latitude, lng: pin.longitude }}
              onClick={() => setSelected(pin)}
            />
          ))}

          {selected && (
            <InfoWindow
              position={{ lat: selected.latitude, lng: selected.longitude }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="text-sm">
                <p className="font-semibold">
                  {selected.bedrooms ? `${selected.bedrooms} bed ` : ''}
                  {selected.property_type ?? 'property'}
                </p>
                <p>
                  {selected.rent_pcm ? `£${selected.rent_pcm}/pcm` : ''}
                  {selected.asking_price ? `£${selected.asking_price}` : ''}
                </p>
                <Link
                  href={`/property/${selected.raia_id}`}
                  className="text-blue-600 underline mt-1 inline-block"
                >
                  View details
                </Link>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
    </div>
  );
}
