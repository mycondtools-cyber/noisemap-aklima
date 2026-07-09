import { useTranslation } from 'react-i18next';
import { useStore } from '../../store';

function statusBadge(status: 'ok' | 'warn' | 'over', worst: boolean) {
  const label = status === 'ok' ? 'OK' : status === 'warn' ? '⚠' : '⛔';
  const cls = worst
    ? 'badge badge-worst'
    : status === 'ok'
      ? 'badge badge-ok'
      : status === 'warn'
        ? 'badge badge-warn'
        : 'badge badge-over';
  return <span className={cls}>{label}</span>;
}

export default function ResultsTable() {
  const { t } = useTranslation();
  const results = useStore((s) => s.results);
  const isCalculating = useStore((s) => s.isCalculating);
  const receivers = useStore((s) => s.receivers);
  const buildings = useStore((s) => s.buildings);

  if (!results && !isCalculating) {
    return (
      <div className="results-panel">
        <h3>{t('sidebar.results')}</h3>
        <div style={{ color: '#64748b' }}>{t('results.empty')}</div>
      </div>
    );
  }

  const worstId = results?.worstReceiverId;
  const rows = results?.receivers ?? [];
  const buildingLabel = (id?: string) => {
    if (!id) return '—';
    const b = buildings.find((x) => x.id === id);
    if (!b) return id.slice(0, 8);
    return b.osmId ? `OSM #${b.osmId}` : id.slice(0, 8);
  };
  const receiverLabel = (id: string) => {
    const r = receivers.find((x) => x.id === id);
    if (!r) return id;
    return `h=${r.h} m`;
  };

  return (
    <div className="results-panel">
      <h3>
        {t('sidebar.results')}
        {isCalculating && (
          <span style={{ marginLeft: 8, color: '#64748b', fontSize: 11 }}>
            · {t('sidebar.recalculate')}…
          </span>
        )}
      </h3>
      <table>
        <thead>
          <tr>
            <th>{t('results.building')}</th>
            <th>{t('results.receiver')}</th>
            <th>{t('results.distance')} (m)</th>
            <th>{t('results.day')}</th>
            <th>{t('results.night')}</th>
            <th>{t('results.dayLimit')}</th>
            <th>{t('results.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((r) => (
            <tr key={r.receiverId}>
              <td>{buildingLabel(r.buildingId)}</td>
              <td>{receiverLabel(r.receiverId)}</td>
              <td>{r.distance.toFixed(1)}</td>
              <td>{r.dBAday.toFixed(1)}</td>
              <td>{r.dBAnight.toFixed(1)}</td>
              <td>{r.normLimit}</td>
              <td>{statusBadge(r.status, r.receiverId === worstId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 60 && (
        <div style={{ color: '#64748b', marginTop: 4 }}>
          … {rows.length - 60} more rows omitted
        </div>
      )}
    </div>
  );
}
