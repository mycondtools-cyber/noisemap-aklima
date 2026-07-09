import { useTranslation } from 'react-i18next';

const LEVELS: { level: number; color: string }[] = [
  { level: 35, color: '#22c55e' },
  { level: 40, color: '#84cc16' },
  { level: 45, color: '#eab308' },
  { level: 50, color: '#f97316' },
  { level: 55, color: '#ef4444' },
  { level: 60, color: '#b91c1c' },
];

export default function MapLegend() {
  const { t } = useTranslation();
  return (
    <div className="map-legend">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('map.legend')}</div>
      {LEVELS.map((l) => (
        <div className="legend-row" key={l.level}>
          <div className="legend-swatch" style={{ background: l.color }} />
          <span>{l.level} dBA</span>
        </div>
      ))}
    </div>
  );
}
