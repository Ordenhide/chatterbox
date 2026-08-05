import Geolocation from '@react-native-community/geolocation';

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
 * Maps the library's numeric error codes (shared with the browser
 * Geolocation API's convention: 1=permission denied, 2=position
 * unavailable, 3=timeout) to a reason the UI can act on differently — the
 * fix for "you said no" (open Settings) differs from "your phone's location
 * is off" (turn it on), so they're kept distinct rather than one generic
 * failure.
 */
function toLocationError(error: {code: number; message?: string}): LocationError {
  if (error.code === 1) return new LocationError('denied', 'Location permission denied');
  if (error.code === 2) return new LocationError('services-off', 'Location services are off or unavailable');
  return new LocationError('unavailable', error.message || 'Could not determine location');
}

/** One-shot read, used to get the initial position before starting a share. */
export function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy}),
      error => reject(toLocationError(error)),
      {enableHighAccuracy: true, timeout: 15000},
    );
  });
}

/**
 * Starts a foreground position watch. `distanceFilter` suppresses callbacks
 * for insignificant movement at the source, on top of whatever time-based
 * throttle the caller applies before writing to Firestore (see
 * liveLocation.ts's shouldSendLocationUpdate). Callers must stop the watch
 * themselves (e.g. on unmount/blur) — nothing here keeps running once the
 * screen that started it goes away, which is what keeps this foreground-only.
 */
export function watchMyPosition(onPosition: (position: Position) => void, onError: (error: LocationError) => void): () => void {
  const watchId = Geolocation.watchPosition(
    pos => onPosition({latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy}),
    error => onError(toLocationError(error)),
    {enableHighAccuracy: true, distanceFilter: 20},
  );
  return () => Geolocation.clearWatch(watchId);
}
