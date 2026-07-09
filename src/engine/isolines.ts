// Wrap turf.js isolines into a GeoJSON FeatureCollection tagged with a level.

import { isolines as turfIsolines, featureCollection, point } from '@turf/turf';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';
import type { GridPoint } from './types';

export function generateIsolines(
  gridPoints: readonly GridPoint[],
  levels: readonly number[] = [35, 40, 45, 50, 55, 60],
): FeatureCollection<MultiLineString> {
  if (gridPoints.length < 4) {
    return featureCollection<MultiLineString>([]) as FeatureCollection<MultiLineString>;
  }
  const fc = featureCollection(
    gridPoints.map((g) => point([g.lng, g.lat], { LpA: g.LpA })),
  );
  const result = turfIsolines(fc, Array.from(levels), { zProperty: 'LpA' });
  return result as unknown as FeatureCollection<MultiLineString>;
}

export function isolineColor(level: number): string {
  if (level >= 60) return '#c62828';
  if (level >= 55) return '#ef6c00';
  if (level >= 50) return '#f9a825';
  if (level >= 45) return '#9e9d24';
  if (level >= 40) return '#558b2f';
  return '#2e7d32';
}

export function receiverColor(LpA: number, norm: number): string {
  if (LpA > norm) return '#c62828';
  if (LpA > norm - 5) return '#f9a825';
  return '#2e7d32';
}

export type IsolineFeature = Feature<MultiLineString, { LpA: number }>;
