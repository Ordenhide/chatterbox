import {formatCoordinates, latLngToTile, staticMapTileUrl} from '../mapTile';

describe('latLngToTile', () => {
  it('maps any position to the single tile at zoom 0', () => {
    expect(latLngToTile(51.5074, -0.1278, 0)).toEqual({x: 0, y: 0, z: 0});
    expect(latLngToTile(-33.87, 151.21, 0)).toEqual({x: 0, y: 0, z: 0});
  });

  it('maps the lat/lng origin (0,0) to the center tile at zoom 1', () => {
    expect(latLngToTile(0, 0, 1)).toEqual({x: 1, y: 1, z: 1});
  });

  it('clamps to the valid tile range rather than producing an out-of-bounds tile', () => {
    const {x, y} = latLngToTile(89.9, 179.9, 3);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(2 ** 3);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(2 ** 3);
  });
});

describe('staticMapTileUrl', () => {
  it('builds a well-formed OpenStreetMap tile URL with no API key', () => {
    const url = staticMapTileUrl(0, 0, 1);
    expect(url).toBe('https://tile.openstreetmap.org/1/1/1.png');
  });
});

describe('formatCoordinates', () => {
  it('formats with hemisphere letters instead of raw signed numbers', () => {
    expect(formatCoordinates(37.7749, -122.4194)).toBe('37.7749°N, 122.4194°W');
    expect(formatCoordinates(-33.8688, 151.2093)).toBe('33.8688°S, 151.2093°E');
  });
});
