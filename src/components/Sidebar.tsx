// Right-hand panel: search, sources, buildings, barriers, norms, results.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { useGeocoder, GeocodeResult } from '../hooks/useGeocoder';
import { generateReceivers } from '../engine/receivers';
import { ResultsTable } from './ResultsTable';
import type { CountryNorm, Source } from '../engine/types';

interface SidebarProps {
  onAddSource: () => void;
  onEditSource: (id: string) => void;
  onExportPdf: () => void;
  onRecalculate: () => void;
}

export function Sidebar({
  onAddSource,
  onEditSource,
  onExportPdf,
  onRecalculate,
}: SidebarProps) {
  const { t } = useTranslation();
  const project = useStore((s) => s.project);
  const equipment = useStore((s) => s.equipment);
  const setNorms = useStore((s) => s.setNorms);
  const setCenter = useStore((s) => s.setCenter);
  const toggleProtected = useStore((s) => s.toggleProtected);
  const removeSource = useStore((s) => s.removeSource);
  const removeBarrier = useStore((s) => s.removeBarrier);
  const setReceivers = useStore((s) => s.setReceivers);

  const { results, search, loading } = useGeocoder();
  const [query, setQuery] = useState('');

  const handleGeocode = (r: GeocodeResult) => {
    setCenter([r.lat, r.lng]);
    setQuery(r.display_name);
  };

  const handleGenerateReceivers = () => {
    const generated = generateReceivers(project.buildings);
    setReceivers([
      ...project.receivers.filter((r) => !r.auto),
      ...generated,
    ]);
    onRecalculate();
  };

  return (
    <aside className="sidebar">
      <section>
        <input
          type="search"
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value);
            void search(e.target.value);
          }}
        />
        {loading ? <div className="muted">…</div> : null}
        {results.length > 0 ? (
          <ul className="geocode-results">
            {results.map((r) => (
              <li key={`${r.lat}-${r.lng}`}>
                <button type="button" onClick={() => handleGeocode(r)}>
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <div className="section-head">
          <h4>{t('sidebar.norms')}</h4>
        </div>
        <select
          value={project.norms.country}
          onChange={(e) => setNorms(e.target.value as CountryNorm)}
        >
          <option value="PL">
            {t('country.PL')} — {t('results.day')} 50 / {t('results.night')} 40
          </option>
          <option value="UA">
            {t('country.UA')} — {t('results.day')} 55 / {t('results.night')} 45
          </option>
        </select>
      </section>

      <section>
        <div className="section-head">
          <h4>{t('sidebar.sources')}</h4>
          <button type="button" onClick={onAddSource}>
            + {t('sidebar.addSource')}
          </button>
        </div>
        {project.sources.length === 0 ? (
          <p className="muted">{t('sidebar.empty')}</p>
        ) : (
          <ul className="row-list">
            {project.sources.map((s: Source) => {
              const eq = equipment.find((e) => e.id === s.modelId);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => onEditSource(s.id)}>
                    <strong>{eq ? `${eq.brand} ${eq.model}` : s.modelId}</strong>
                    <span className="muted">
                      {' '}
                      · {s.count}× · {s.mounting} · {s.hs.toFixed(1)} m
                    </span>
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeSource(s.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="section-head">
          <h4>{t('sidebar.buildings')}</h4>
        </div>
        {project.buildings.length === 0 ? (
          <p className="muted">{t('sidebar.empty')}</p>
        ) : (
          <ul className="row-list">
            {project.buildings.slice(0, 30).map((b) => (
              <li key={b.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={b.protected}
                    onChange={() => toggleProtected(b.id)}
                  />
                  {b.id.replace('osm-', '').slice(0, 18)} · {b.height} m
                </label>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={handleGenerateReceivers}>
          {t('sidebar.generateReceivers')}
        </button>
      </section>

      <section>
        <div className="section-head">
          <h4>{t('sidebar.barriers')}</h4>
        </div>
        {project.barriers.length === 0 ? (
          <p className="muted">{t('sidebar.empty')}</p>
        ) : (
          <ul className="row-list">
            {project.barriers.map((b) => (
              <li key={b.id}>
                {b.id.slice(0, 12)} · {b.height} m
                <button
                  type="button"
                  className="danger"
                  onClick={() => removeBarrier(b.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="section-head">
          <h4>{t('sidebar.results')}</h4>
          <button type="button" onClick={onRecalculate}>
            {t('sidebar.recalculate')}
          </button>
        </div>
        <ResultsTable />
      </section>

      <section>
        <button type="button" className="primary" onClick={onExportPdf}>
          {t('sidebar.generatePdf')}
        </button>
      </section>
    </aside>
  );
}
