import { useTranslation } from 'react-i18next';
import { useStore } from '../../store';

export default function BuildingList() {
  const { t } = useTranslation();
  const buildings = useStore((s) => s.buildings);
  const updateBuilding = useStore((s) => s.updateBuilding);
  const removeBuilding = useStore((s) => s.removeBuilding);

  if (buildings.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#64748b' }}>{t('sidebar.empty')}</div>
    );
  }

  return (
    <div style={{ maxHeight: 180, overflow: 'auto' }}>
      {buildings.map((b) => (
        <div key={b.id} className="item-row">
          <div>
            <div className="item-title">
              {b.osmId ? `OSM #${b.osmId}` : b.id.slice(0, 8)}
            </div>
            <div className="item-meta">
              h={b.height.toFixed(1)} m ·{' '}
              {b.protected ? t('results.status') : '—'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={b.protected}
                onChange={(e) =>
                  updateBuilding(b.id, { protected: e.target.checked })
                }
              />
              <span style={{ fontSize: 11 }}>P</span>
            </label>
            <button
              className="danger"
              type="button"
              onClick={() => removeBuilding(b.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
