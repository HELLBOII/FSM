import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { Building2, FileText } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createTechnicianIcon = (status) => {
  const colors = {
    available: '#22c55e',
    on_job: '#3b82f6',
    break: '#eab308',
    offline: '#9ca3af',
  };
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 36px; height: 36px; background: ${colors[status] || colors.offline};
        border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
}

/**
 * Opens the popup for the marker matching focusedMarker (when user selects from list).
 */
function OpenFocusedPopup({ focusedMarker, jobMarkerRefs, techMarkerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!focusedMarker) return;
    map.closePopup();
    const openPopup = () => {
      const marker =
        focusedMarker.type === 'client'
          ? jobMarkerRefs.current[focusedMarker.id]
          : techMarkerRefs.current[focusedMarker.id];
      if (marker && typeof marker.openPopup === 'function') {
        marker.openPopup();
      }
    };
    const t = setTimeout(openPopup, 150);
    return () => clearTimeout(t);
  }, [focusedMarker, map, jobMarkerRefs, techMarkerRefs]);
  return null;
}

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
 * Fit map view to all markers when map is ready. On initial navigate to LiveTracking page the
 * container may not have size yet, so we retry at several delays so locations get focused.
 * Only runs until first successful fit (then stops so tab switches don't keep refitting).
 */
function FitBoundsToMarkers({ technicians = [], jobs = [] }) {
  const map = useMap();
  const hasFitted = useRef(false);
  useEffect(() => {
    if (hasFitted.current) return;
    const points = [
      ...technicians
        .filter((t) => t.current_location?.lat)
        .map((t) => [t.current_location.lat, t.current_location.lng]),
      ...jobs
        .filter((j) => j.location?.lat)
        .map((j) => [j.location.lat, j.location.lng]),
    ];
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    const run = () => {
      if (hasFitted.current) return;
      map.invalidateSize();
      const size = map.getContainer()?.getBoundingClientRect();
      if (size && size.width < 10) return; // container not ready, next retry will run
      if (points.length === 1) {
        map.setView(points[0], Math.max(map.getZoom(), 10));
      } else {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
      hasFitted.current = true;
    };
    // Retry at multiple delays so we catch the map once container has size on initial navigate
    const t1 = setTimeout(run, 150);
    const t2 = setTimeout(run, 500);
    const t3 = setTimeout(run, 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map, technicians, jobs]);
  return null;
}

const createJobIcon = (priority) => {
  const colors = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#3b82f6',
    low: '#6b7280',
  };
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

/**
 * Live Tracking Map – used only on LiveTracking page.
 * Shows technicians, jobs/clients, selection panning, and click handlers.
 */
export default function LiveTrackingMap({
  technicians = [],
  jobs = [],
  center,
  zoom = 8,
  onTechnicianClick,
  onJobClick,
  onCreateServiceRequest,
  className,
  selectedLocation,
  focusedMarker = null,
}) {
  const jobMarkerRefs = useRef({});
  const techMarkerRefs = useRef({});
  const usBounds = L.latLngBounds([24, -125], [49, -66]);
  const defaultCenter = [39.5, -98.5];
  const calculatedCenter = center || (() => {
    const allLocations = [
      ...technicians.filter((t) => t.current_location?.lat).map((t) => t.current_location),
      ...jobs.filter((j) => j.location?.lat).map((j) => j.location),
    ];
    if (allLocations.length > 0) {
      const avgLat = allLocations.reduce((s, loc) => s + loc.lat, 0) / allLocations.length;
      const avgLng = allLocations.reduce((s, loc) => s + loc.lng, 0) / allLocations.length;
      return [avgLat, avgLng];
    }
    return defaultCenter;
  })();

  return (
    <div className={cn('rounded-xl overflow-hidden border border-gray-200 shadow-sm', className)}>
      <MapContainer
        center={calculatedCenter}
        zoom={zoom}
        className="h-full w-full min-h-[400px]"
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
        <FitBoundsToMarkers technicians={technicians} jobs={jobs} />
        {selectedLocation && <ChangeMapView center={selectedLocation} />}
        <OpenFocusedPopup
          focusedMarker={focusedMarker}
          jobMarkerRefs={jobMarkerRefs}
          techMarkerRefs={techMarkerRefs}
        />

        {technicians.map((tech) => {
          if (!tech.current_location?.lat) return null;
          const sameLocationTechs = technicians.filter(
            (t) =>
              t.current_location?.lat &&
              Math.abs(t.current_location.lat - tech.current_location.lat) < 0.0001 &&
              Math.abs(t.current_location.lng - tech.current_location.lng) < 0.0001
          );
          let offsetLat = 0,
            offsetLng = 0;
          if (sameLocationTechs.length > 1) {
            const sameIndex = sameLocationTechs.findIndex((t) => t.id === tech.id);
            const angle = (sameIndex * 360) / sameLocationTechs.length;
            const radius = 0.0003;
            offsetLat = radius * Math.cos((angle * Math.PI) / 180);
            offsetLng = radius * Math.sin((angle * Math.PI) / 180);
          }
          return (
            <Marker
              key={tech.id}
              ref={(r) => {
                if (r) techMarkerRefs.current[tech.id] = r;
              }}
              position={[
                tech.current_location.lat + offsetLat,
                tech.current_location.lng + offsetLng,
              ]}
              icon={createTechnicianIcon(tech.availability_status)}
              eventHandlers={{ click: () => onTechnicianClick?.(tech) }}
            >
              <Popup>
                <div className="p-2 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-emerald-700">{tech.name?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{tech.name}</p>
                      <p className="text-xs text-gray-500">{tech.employee_id}</p>
                    </div>
                  </div>
                  <StatusBadge status={tech.availability_status} size="sm" />
                </div>
              </Popup>
            </Marker>
          );
        })}

        {jobs.map((job) =>
          job.location?.lat ? (
            <Marker
              key={job.id}
              ref={(r) => {
                if (r) jobMarkerRefs.current[job.id] = r;
              }}
              position={[job.location.lat, job.location.lng]}
              icon={createJobIcon(job.priority)}
              eventHandlers={{ click: () => onJobClick?.(job) }}
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
