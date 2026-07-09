import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import equipment from '../../data/equipment.json';
import type {
  EquipmentModel,
  MountingType,
  OperatingMode,
  Source,
} from '../../types';

const EQUIPMENT = equipment as EquipmentModel[];

interface Props {
  initial?: Source;
  onSubmit: (source: Omit<Source, 'id' | 'lat' | 'lng'>) => void;
  onCancel?: () => void;
}

export default function SourceForm({ initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [modelId, setModelId] = useState(initial?.modelId ?? EQUIPMENT[0].id);
  const [hs, setHs] = useState(initial?.hs ?? 1.5);
  const [mounting, setMounting] = useState<MountingType>(
    initial?.mounting ?? 'wall',
  );
  const [count, setCount] = useState(initial?.count ?? 1);
  const [mode, setMode] = useState<OperatingMode>(initial?.mode ?? 'both');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ modelId, hs, mounting, count, mode });
  };

  return (
    <form onSubmit={submit}>
      <label>{t('source.model')}</label>
      <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
        {EQUIPMENT.map((m) => (
          <option key={m.id} value={m.id}>
            {m.brand} {m.model} ({m.lwA} dBA)
          </option>
        ))}
      </select>

      <label>{t('source.height')}</label>
      <input
        type="number"
        step="0.1"
        value={hs}
        onChange={(e) => setHs(parseFloat(e.target.value))}
      />

      <label>{t('source.mounting')}</label>
      <select
        value={mounting}
        onChange={(e) => setMounting(e.target.value as MountingType)}
      >
        <option value="free">{t('source.mounting.free')}</option>
        <option value="wall">{t('source.mounting.wall')}</option>
        <option value="corner">{t('source.mounting.corner')}</option>
      </select>

      <label>{t('source.count')}</label>
      <input
        type="number"
        min={1}
        value={count}
        onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
      />

      <label>{t('source.mode')}</label>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as OperatingMode)}
      >
        <option value="day">{t('source.mode.day')}</option>
        <option value="night">{t('source.mode.night')}</option>
        <option value="both">{t('source.mode.both')}</option>
      </select>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="submit">{t('source.save')}</button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            {t('source.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
