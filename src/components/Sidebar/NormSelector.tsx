import { useTranslation } from 'react-i18next';
import norms from '../../data/norms.json';
import { useStore } from '../../store';
import type { NormSelection } from '../../types';

interface NormRow {
  country: 'PL' | 'UA';
  areaType: 'residential' | 'estate';
  dayLimit: number;
  nightLimit: number;
}
const NORMS = norms as NormRow[];

export function currentLimit(selection: NormSelection): number {
  const row = NORMS.find(
    (n) =>
      n.country === selection.country && n.areaType === selection.areaType,
  );
  if (!row) return 55;
  return selection.timeOfDay === 'day' ? row.dayLimit : row.nightLimit;
}

export default function NormSelector() {
  const { t } = useTranslation();
  const norm = useStore((s) => s.norm);
  const setNorm = useStore((s) => s.setNorm);

  const validAreas = Array.from(
    new Set(NORMS.filter((n) => n.country === norm.country).map((n) => n.areaType)),
  );

  return (
    <div>
      <label>{t('sidebar.norms')}</label>
      <select
        value={norm.country}
        onChange={(e) =>
          setNorm({ ...norm, country: e.target.value as 'PL' | 'UA' })
        }
      >
        <option value="PL">{t('country.PL')}</option>
        <option value="UA">{t('country.UA')}</option>
      </select>
      <select
        value={norm.areaType}
        onChange={(e) =>
          setNorm({
            ...norm,
            areaType: e.target.value as 'residential' | 'estate',
          })
        }
      >
        {validAreas.includes('residential') && (
          <option value="residential">residential</option>
        )}
        {validAreas.includes('estate') && (
          <option value="estate">estate</option>
        )}
      </select>
      <select
        value={norm.timeOfDay}
        onChange={(e) =>
          setNorm({ ...norm, timeOfDay: e.target.value as 'day' | 'night' })
        }
      >
        <option value="day">{t('source.mode.day')}</option>
        <option value="night">{t('source.mode.night')}</option>
      </select>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
        Limit: {currentLimit(norm)} dBA
      </div>
    </div>
  );
}
