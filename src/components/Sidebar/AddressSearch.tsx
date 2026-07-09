import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { geocode, GeocodeResult } from '../../services/photon';
import { useStore } from '../../store';

export default function AddressSearch() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const setMapCenter = useStore((s) => s.setMapCenter);
  const setMapZoom = useStore((s) => s.setMapZoom);

  const lang = (i18n.language as 'en' | 'pl' | 'uk') ?? 'en';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const list = await geocode(q, 5, lang);
      setResults(list);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>{t('sidebar.sources').split(' ')[0]}</h2>
      <form onSubmit={submit}>
        <input
          type="search"
          value={q}
          placeholder={t('search.placeholder')}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      {loading && <div style={{ fontSize: 11 }}>{t('misc.loading') || '…'}</div>}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 4 }}>
          {results.map((r, i) => (
            <li
              key={i}
              style={{
                cursor: 'pointer',
                fontSize: 12,
                padding: '4px 0',
                borderBottom: '1px solid #e2e8f0',
              }}
              onClick={() => {
                setMapCenter(r.position);
                setMapZoom(18);
                setResults([]);
              }}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
