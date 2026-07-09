import { useTranslation } from 'react-i18next';
import equipment from '../../data/equipment.json';
import { useStore } from '../../store';
import type { EquipmentModel } from '../../types';

const EQUIPMENT = equipment as EquipmentModel[];

export default function SourceList() {
  const { t } = useTranslation();
  const sources = useStore((s) => s.sources);
  const removeSource = useStore((s) => s.removeSource);

  const modelById = (id: string): EquipmentModel | undefined =>
    EQUIPMENT.find((m) => m.id === id);

  if (sources.length === 0) {
    return <div style={{ fontSize: 12, color: '#64748b' }}>{t('sidebar.empty')}</div>;
  }
  return (
    <div>
      {sources.map((s) => {
        const m = modelById(s.modelId);
        return (
          <div key={s.id} className="item-row">
            <div>
              <div className="item-title">
                {m ? `${m.brand} ${m.model}` : s.modelId}
                {s.count > 1 ? ` ×${s.count}` : ''}
              </div>
              <div className="item-meta">
                h={s.hs} m · {s.mounting} · {s.mode}
              </div>
            </div>
            <button
              className="danger"
              type="button"
              onClick={() => removeSource(s.id)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
