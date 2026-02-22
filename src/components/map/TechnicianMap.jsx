import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { cn } from "@/lib/utils";
import StatusBadge from '@/components/ui/StatusBadge';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different statuses
const createTechnicianIcon = (status) => {
  const colors = {
    available: '#22c55e',
    on_job: '#3b82f6',
    break: '#eab308',
    offline: '#9ca3af'
  };
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${colors[status] || colors.offline};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Component to update map center when selectedLocation changes
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      // Just pan to the location without changing zoom level
      map.panTo(center, { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
}

const createJobIcon = (priority) => {
  const colors = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#3b82f6',
    low: '#6b7280'
  };
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${colors[priority] || colors.medium};
        border: 2px solid white;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

export default function TechnicianMap({
  technicians = [],
  jobs = [],
  center,
  zoom = 8,
  onTechnicianClick,
  onJobClick,
  className,
  selectedLocation
}) {
  // Auto-calculate center based on data, default to Southwest US
  const defaultCenter = [34.5, -115.0]; // Southwest US region
  const calculatedCenter = center || (() => {
    const allLocations = [
      ...technicians.filter(t => t.current_location?.lat).map(t => t.current_location),
      ...jobs.filter(j => j.location?.lat).map(j => j.location)
    ];
    if (allLocations.length > 0) {
      const avgLat = allLocations.reduce((sum, loc) => sum + loc.lat, 0) / allLocations.length;
      const avgLng = allLocations.reduce((sum, loc) => sum + loc.lng, 0) / allLocations.length;
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
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Update map view when selectedLocation changes */}
        {selectedLocation && <ChangeMapView center={selectedLocation} />}
        
        {/* Technician markers */}
        {technicians.map((tech, index) => {
          if (!tech.current_location?.lat) return null;
          
          // Check if there are multiple technicians at the same location
          const sameLocationTechs = technicians.filter(t => 
            t.current_location?.lat &&
            Math.abs(t.current_location.lat - tech.current_location.lat) < 0.0001 &&
            Math.abs(t.current_location.lng - tech.current_location.lng) < 0.0001
          );
          
          // Add small offset for overlapping markers (spiral pattern)
          let offsetLat = 0;
          let offsetLng = 0;
          if (sameLocationTechs.length > 1) {
            const sameIndex = sameLocationTechs.findIndex(t => t.id === tech.id);
            const angle = (sameIndex * 360) / sameLocationTechs.length;
            const radius = 0.0003; // ~30 meters offset
            offsetLat = radius * Math.cos(angle * Math.PI / 180);
            offsetLng = radius * Math.sin(angle * Math.PI / 180);
          }
          
          return (
            <Marker
              key={tech.id}
              position={[
                tech.current_location.lat + offsetLat,
                tech.current_location.lng + offsetLng
              ]}
              icon={createTechnicianIcon(tech.availability_status)}
              eventHandlers={{
                click: () => onTechnicianClick?.(tech)
              }}
            >
              <Popup>
                <div className="p-2 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-emerald-700">
                        {tech.name?.charAt(0)}
                      </span>
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
        
        {/* Job markers */}
        {jobs.map((job) => (
          job.location?.lat && (
            <Marker
              key={job.id}
              position={[job.location.lat, job.location.lng]}
              icon={createJobIcon(job.priority)}
              eventHandlers={{
                click: () => onJobClick?.(job)
              }}
            >
              <Popup>
                <div className="p-2 min-w-[140px]">
                  {job.request_number ? (
                    <>
                      <p className="font-semibold text-gray-900 text-sm mb-1">#{job.request_number}</p>
                      <p className="text-xs text-gray-600 mb-1">{job.client_name}</p>
                      <p className="text-xs text-gray-500 mb-2">{job.farm_name}</p>
                      <div className="flex gap-1.5">
                        <StatusBadge status={job.status} size="xs" />
                        <StatusBadge status={job.priority} size="xs" />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900 text-sm mb-0.5">{job.client_name}</p>
                      <p className="text-xs text-gray-500">{job.farm_name}</p>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}