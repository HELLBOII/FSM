import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { cn } from '@/lib/utils';
import { Building2, FileText } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createJobIcon = (priority) => {
  const colors = { urgent: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#6b7280' };
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 28px; height: 28px; background: ${colors[priority] || colors.medium};
        border: 2px solid white; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const runInvalidate = () => map.invalidateSize();
    runInvalidate();
    const raf = requestAnimationFrame(runInvalidate);
    const t1 = setTimeout(runInvalidate, 100);
    const t2 = setTimeout(runInvalidate, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimationFrame(raf);
    };
  }, [map]);
  return null;
}

/**
 * Dashboard Live Map – used only on AdminDashboard.
 * Shows client/farm locations with attractive tooltip and "Create service request" option.
 */
export default function DashboardMap({ jobs = [], center, zoom = 8, className, onCreateServiceRequest }) {
  const usBounds = L.latLngBounds([24, -125], [49, -66]);
  const defaultCenter = [39.5, -98.5];
  const calculatedCenter = center || (() => {
    const locs = jobs.filter(j => j.location?.lat).map(j => j.location);
    if (locs.length === 0) return defaultCenter;
    const avgLat = locs.reduce((s, loc) => s + loc.lat, 0) / locs.length;
    const avgLng = locs.reduce((s, loc) => s + loc.lng, 0) / locs.length;
    return [avgLat, avgLng];
  })();

  return (
    <div className={cn('rounded-xl overflow-hidden border border-gray-200 shadow-sm', className)}>
      <MapContainer
        center={calculatedCenter}
        zoom={zoom}
        className="h-full w-full min-h-[300px]"
        scrollWheelZoom
        maxBounds={usBounds}
        maxBoundsViscosity={1}
        minZoom={3}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapInvalidateSize />
        {jobs.map((job) =>
          job.location?.lat ? (
            <Marker
              key={job.id}
              position={[job.location.lat, job.location.lng]}
              icon={createJobIcon(job.priority)}
            >
              <Popup className="client-marker-popup">
                <div className="min-w-[200px] p-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-white">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="font-semibold text-sm truncate">{job.client_name}</span>
                    </div>
                    {job.farm_name && (
                      <p className="text-emerald-100 text-xs mt-0.5 truncate">{job.farm_name}</p>
                    )}
                  </div>
                  <div className="p-2.5">
                    {onCreateServiceRequest && (
                      <button
                        type="button"
                        onClick={() => onCreateServiceRequest(job)}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-3 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Create service request
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}
