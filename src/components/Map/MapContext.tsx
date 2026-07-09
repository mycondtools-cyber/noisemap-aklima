import { createContext, useContext } from 'react';
import type { Map as MLMap } from 'maplibre-gl';

export const MapContext = createContext<MLMap | null>(null);

export function useMap(): MLMap | null {
  return useContext(MapContext);
}
