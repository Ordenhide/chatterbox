export interface Position {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type LocationErrorReason = 'denied' | 'services-off' | 'unavailable';

export class LocationError extends Error {
  reason: LocationErrorReason;
  constructor(reason: LocationErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Maps the browser's GeolocationPositionError codes (1=permission denied,
 * 2=position unavailable, 3=timeout) to a reason the UI can act on
 * differently — the fix for "you said no" (change the site permission)
 * differs from "your device's location is off" (turn it on), so they're
 * kept distinct rather than one generic failure.
 */
function toLocationError(error: GeolocationPositionError): LocationError {
  if (error.code === error.PERMISSION_DENIED) return new LocationError('denied', 'Location permission denied');
  if (error.code === error.POSITION_UNAVAILABLE) {
    return new LocationError('services-off', 'Location services are off or unavailable');
  }
  return new LocationError('unavailable', error.message || 'Could not determine location');
}

/** One-shot read, used to get the initial position before starting a share. */
export function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new LocationError('unavailable', 'Geolocation is not supported in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy}),
      error => reject(toLocationError(error)),
      {enableHighAccuracy: true, timeout: 15000},
    );
  });
}

/**
 * Starts a foreground position watch. Callers must stop the watch
 * themselves (e.g. on unmount/chat switch) — nothing here keeps running
 * once the component that started it goes away, which is what keeps this
 * foreground-only. The browser API has no distanceFilter equivalent, so
 * suppressing insignificant-movement callbacks is left entirely to the
 * caller's time-based throttle (see liveLocation.ts's shouldSendLocationUpdate).
 */
export function watchMyPosition(onPosition: (position: Position) => void, onError: (error: LocationError) => void): () => void {
  if (!navigator.geolocation) {
    onError(new LocationError('unavailable', 'Geolocation is not supported in this browser'));
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    pos => onPosition({latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy}),
    error => onError(toLocationError(error)),
    {enableHighAccuracy: true, maximumAge: 10000},
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
