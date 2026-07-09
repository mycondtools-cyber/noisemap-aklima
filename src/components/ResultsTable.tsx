// Colour-coded results table. Sorts by worst receiver, tags the top row with an
// explicit "worst" label so users can jump to it on the map.

import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import type { Receiver } from '../engine/types';

function fmt(n?: number): string {
  return n != null && Number.isFinite(n) ? n.toFixed(1) : '—';
}

function statusClass(Lp: number, limit: number): 'ok' | 'warn' | 'fail' {
  if (!Number.isFinite(Lp)) return 'ok';
  if (Lp > limit) return 'fail';
  if (Lp > limit - 5) return 'warn';
  return 'ok';
}

export function ResultsTable() {
  const { t } = useTranslation();
  const project = useStore((s) => s.project);
  const receivers = project.receivers;

  const sorted = [...receivers].sort((a, b) => worst(b) - worst(a));

  if (sorted.length === 0) {
    return <p className="muted">{t('results.empty')}</p>;
  }

  return (
    <div className="results-table">
      <table>
        <thead>
          <tr>
            <th>{t('results.receiver')}</th>
            <th>{t('results.building')}</th>
            <th>{t('results.day')}</th>
            <th>{t('results.dayLimit')}</th>
            <th>{t('results.night')}</th>
            <th>{t('results.nightLimit')}</th>
            <th>{t('results.status')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => {
            const day = r.results?.LpA_day ?? NaN;
            const night = r.results?.LpA_night ?? NaN;
            const dayCls = statusClass(day, project.norms.dayLimit);
            const nightCls = statusClass(night, project.norms.nightLimit);
            const worstCls =
              dayCls === 'fail' || nightCls === 'fail'
                ? 'fail'
                : dayCls === 'warn' || nightCls === 'warn'
                  ? 'warn'
                  : 'ok';
            return (
              <tr key={r.id} className={`row-${worstCls}`}>
                <td>
                  {idx === 0 ? '⚑ ' : ''}
                  {r.id.slice(0, 12)}
                </td>
                <td>{r.buildingId?.slice(0, 12) ?? '—'}</td>
                <td className={`c-${dayCls}`}>{fmt(day)}</td>
                <td>{project.norms.dayLimit}</td>
                <td className={`c-${nightCls}`}>{fmt(night)}</td>
                <td>{project.norms.nightLimit}</td>
                <td>{t(`results.${worstCls}`)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function worst(r: Receiver): number {
  return Math.max(r.results?.LpA_day ?? 0, r.results?.LpA_night ?? 0);
}
