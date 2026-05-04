import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { cn } from '@/lib/utils';
import { Circle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/** Wireframe pin colors (fsm_irrigation_wireframe.html) */
export const MAP_PIN_COLORS = {
  scheduled: '#534AB7',
  unscheduled: '#EF9F27',
  overdue: '#E24B4A',
  completed: '#1D9E75',
  reactive: '#378ADD',
};
const MAP_STATUS_BADGE_CLASS = {
  scheduled: 'bg-[#EEEDFE] text-[#534AB7]',
  unscheduled: 'bg-[#FAEEDA] text-[#BA7517]',
  overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
  completed: 'bg-[#EAF3DE] text-[#3B6D11]',
  reactive: 'bg-[#E6F1FB] text-[#185FA5]',
};

function pointInPolygon(point, polygon) {
  let inside = false;
  const { x, y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > y !== yj > y && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

const OSM_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

const SATELLITE_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
};

/**
 * Circular map pin matching irrigation wireframe (.pin-circle).
 * @param {string} fillColor — hex color
 * @param {boolean} selected — slightly larger when selected
 */
function createWireframePinIcon(fillColor, selected) {
  const size = selected ? 22 : 18;
  const border = selected ? 3 : 2;
  return L.divIcon({
    className: 'map-pin-wireframe',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${fillColor};border:${border}px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);box-sizing:border-box;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
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

function FlyTo({ lat, lng, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), zoom), { duration: 0.6 });
  }, [lat, lng, zoom, map]);
  return null;
}

/**
 * Dashboard Live Map – AdminDashboard wireframe-style pins + optional satellite layer.
 * @param {Array} jobs — items with location.lat/lng, pinColor or mapStatus, client_name, etc.
 * @param {'streets'|'satellite'} baseLayer
 * @param {string|null} selectedJobId
 * @param {(job: object) => void} [onSelectJob]
 * @param {(job: object) => void} [onOpenClientDetail]
 * @param {(job: object) => void} [onCreateServiceRequest]
 * @param {{lat:number,lng:number}|null} [flyToTarget] — pan map when list selection changes
 * @param {'default'|'embedded'} [variant] — embedded drops outer chrome for layout inside wireframe shell
 * @param {React.ReactNode} [toolbarEnd] — e.g. expand map; rendered after lasso / clear controls
 * @param {number} [listSelectionPopupNonce] — increment when list row selects a client to open that marker's popup
 */
export default function DashboardMap({
  jobs = [],
  center,
  zoom = 8,
  className,
  baseLayer = 'streets',
  autoCenterFromJobs = true,
  selectedJobId = null,
  onSelectJob,
  onOpenClientDetail,
  onCreateServiceRequest,
  onLassoSelectionChange,
  flyToTarget = null,
  variant = 'default',
  toolbarEnd = null,
  listSelectionPopupNonce = 0,
}) {
  const mapRef = useRef(null);
  const markerLeafletRefs = useRef({});
  const lassoPointsRef = useRef([]);
  const isDrawingRef = useRef(false);
  const [lassoMode, setLassoMode] = useState(false);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoPoints, setLassoPoints] = useState([]);
  const [lassoSelectedIds, setLassoSelectedIds] = useState([]);
  const usBounds = L.latLngBounds([24, -125], [49, -66]);
  const defaultCenter = [39.5, -98.5];
  const calculatedCenter = center || (!autoCenterFromJobs ? defaultCenter : (() => {
    const locs = jobs.filter((j) => j.location?.lat != null && j.location?.lng != null).map((j) => j.location);
    if (locs.length === 0) return defaultCenter;
    const avgLat = locs.reduce((s, loc) => s + loc.lat, 0) / locs.length;
    const avgLng = locs.reduce((s, loc) => s + loc.lng, 0) / locs.length;
    return [avgLat, avgLng];
  })());

  const tile = useMemo(
    () => (baseLayer === 'satellite' ? SATELLITE_TILE : OSM_TILE),
    [baseLayer]
  );

  const pinFor = (job) => {
    const color = job.pinColor || MAP_PIN_COLORS[job.mapStatus] || MAP_PIN_COLORS.unscheduled;
    const selected = selectedJobId != null && String(selectedJobId) === String(job.id);
    return createWireframePinIcon(color, selected);
  };

  const clearLasso = useCallback(() => {
    lassoPointsRef.current = [];
    isDrawingRef.current = false;
    setLassoPoints([]);
    setLassoSelectedIds([]);
    onLassoSelectionChange?.([]);
  }, [onLassoSelectionChange]);

  const toggleLassoMode = () => {
    setLassoMode((prev) => {
      const next = !prev;
      if (!next) {
        setIsDrawingLasso(false);
        clearLasso();
      }
      return next;
    });
  };

  const onDrawStart = (e) => {
    if (!lassoMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const initial = [{ x, y }];
    lassoPointsRef.current = initial;
    isDrawingRef.current = true;
    setLassoPoints(initial);
    setIsDrawingLasso(true);
    if (mapRef.current) {
      mapRef.current.dragging.disable();
      mapRef.current.doubleClickZoom.disable();
      mapRef.current.scrollWheelZoom.disable();
    }
    if (e.currentTarget.setPointerCapture && e.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  };

  const onDrawMove = (e) => {
    if (!lassoMode || !isDrawingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const prev = lassoPointsRef.current;
    const last = prev[prev.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) < 3) return;
    const next = [...prev, { x, y }];
    lassoPointsRef.current = next;
    setLassoPoints(next);
    e.preventDefault();
  };

  const onDrawEnd = () => {
    if (!lassoMode || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawingLasso(false);
    if (mapRef.current) {
      mapRef.current.dragging.enable();
      mapRef.current.doubleClickZoom.enable();
      mapRef.current.scrollWheelZoom.enable();
    }
    const finalPoints = lassoPointsRef.current;
    if (finalPoints.length < 3 || !mapRef.current) {
      clearLasso();
      return;
    }
    const selected = jobs.filter((job) => {
      if (job.location?.lat == null || job.location?.lng == null) return false;
      const p = mapRef.current.latLngToContainerPoint([job.location.lat, job.location.lng]);
      return pointInPolygon({ x: p.x, y: p.y }, finalPoints);
    }).map((job) => String(job.id));
    setLassoSelectedIds(selected);
    onLassoSelectionChange?.(selected);
  };

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.dragging.enable();
        mapRef.current.doubleClickZoom.enable();
        mapRef.current.scrollWheelZoom.enable();
      }
    };
  }, []);

  /** Open the same Leaflet popup as hover when a client is chosen from the sidebar list. */
  useEffect(() => {
    if (!listSelectionPopupNonce || selectedJobId == null) return;
    const id = String(selectedJobId);
    const tryOpen = () => {
      const m = markerLeafletRefs.current[id];
      if (m && typeof m.openPopup === 'function') {
        try {
          m.openPopup();
        } catch {
          // ignore
        }
      }
    };
    const t0 = window.setTimeout(tryOpen, 0);
    const t1 = window.setTimeout(tryOpen, 700);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [listSelectionPopupNonce, selectedJobId]);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#e8efe6]',
        variant === 'default' && 'rounded-xl border border-gray-200 shadow-sm',
        variant === 'embedded' && 'rounded-none border-0 shadow-none h-full min-h-0',
        className
      )}
    >
      <MapContainer
        center={calculatedCenter}
        zoom={zoom}
        className={cn('h-full w-full min-h-[300px] z-0', variant === 'embedded' && 'min-h-0')}
        scrollWheelZoom
        maxBounds={usBounds}
        maxBoundsViscosity={1}
        minZoom={3}
        zoomControl={false}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
      >
        <TileLayer key={tile.url} attribution={tile.attribution} url={tile.url} />
        <ZoomControl position="topleft" />
        <MapInvalidateSize />
        {flyToTarget?.lat != null && flyToTarget?.lng != null && (
          <FlyTo lat={flyToTarget.lat} lng={flyToTarget.lng} />
        )}
        {jobs.map((job) =>
          job.location?.lat != null && job.location?.lng != null ? (
            <Marker
              key={`${job.id}-${String(selectedJobId) === String(job.id) ? 's' : 'n'}`}
              ref={(instance) => {
                const key = String(job.id);
                if (instance == null) {
                  delete markerLeafletRefs.current[key];
                } else {
                  markerLeafletRefs.current[key] = instance;
                }
              }}
              position={[job.location.lat, job.location.lng]}
              icon={pinFor(job)}
              eventHandlers={{
                click: () => {
                  onSelectJob?.(job);
                  onOpenClientDetail?.(job);
                },
                mouseover: (e) => {
                  e.target.openPopup();
                },
                mouseout: (e) => {
                  e.target.closePopup();
                },
              }}
            >
              <Popup className="map-wireframe-popup" minWidth={220}>
                <div className="p-1 -m-1 text-left">
                  <div className="font-medium text-[13px] text-gray-900 leading-tight">{job.client_name}</div>
                  {job.location?.address ? (
                    <div className="text-[11px] text-gray-600 mt-0.5 mb-2 line-clamp-2">{job.location.address}</div>
                  ) : (
                    <div className="h-1" />
                  )}
                  <div className="flex justify-between text-[11px] gap-2 text-gray-700">
                    <span className="text-gray-400 shrink-0">Next appt</span>
                    <span className="text-right truncate">{job.nextApptText ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] gap-2 mt-1 text-gray-700">
                    <span className="text-gray-400 shrink-0">Status</span>
                    <span
                      className={cn(
                        'inline-block rounded-[10px] px-2 py-0.5 text-[10px] font-medium',
                        MAP_STATUS_BADGE_CLASS[job.mapStatus] || MAP_STATUS_BADGE_CLASS.unscheduled
                      )}
                    >
                      {job.mapStatusLabel ?? '—'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-2.5 w-full py-1.5 text-[11px] font-medium rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    onClick={() => onOpenClientDetail?.(job)}
                  >
                    Click to view client card
                  </button>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>

      {/* Wireframe-style overlay; map interactions remain on the tiles */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLassoMode}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm transition-colors',
              lassoMode ?
              'border-emerald-300 bg-emerald-50 text-emerald-800' :
              'border-black/10 bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            <Circle className="h-3 w-3 shrink-0" strokeWidth={2} />
            {lassoMode ? 'Exit lasso' : 'Lasso filter'}
          </button>
          {lassoSelectedIds.length > 0 ? (
            <button
              type="button"
              onClick={clearLasso}
              className="rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[11px] text-gray-600 shadow-sm hover:bg-gray-50"
            >
              Clear ({lassoSelectedIds.length})
            </button>
          ) : null}
          {toolbarEnd}
        </div>
      </div>

      {lassoMode &&
      <div
        className={cn('absolute inset-0 z-10 touch-none', isDrawingLasso ? 'cursor-crosshair' : 'cursor-crosshair')}
        onPointerDown={onDrawStart}
        onPointerMove={onDrawMove}
        onPointerUp={onDrawEnd}
        onPointerCancel={onDrawEnd}
      >
          <svg className="h-full w-full">
            {lassoPoints.length > 1 &&
          <>
                <polyline
              points={lassoPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#0F6E56"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
                {!isDrawingLasso &&
            <polygon
              points={lassoPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(15,110,86,0.15)"
              stroke="#0F6E56"
              strokeWidth="2"
            />
            }
              </>
          }
          </svg>
        </div>
      }
    </div>
  );
}
