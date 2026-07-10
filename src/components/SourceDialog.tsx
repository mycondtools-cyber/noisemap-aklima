// Modal dialog for adding or editing a noise source.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import type {
  EquipmentModel,
  MountingType,
  OperatingMode,
  Source,
} from '../engine/types';

interface Props {
  initial?: Source;
  lat?: number;
  lng?: number;
  defaultHs?: number;
  defaultMounting?: MountingType;
  onClose: () => void;
}

export function SourceDialog({ initial, lat, lng, defaultHs, defaultMounting, onClose }: Props) {
  const { t } = useTranslation();
  const equipment = useStore((s) => s.equipment);
  const addSource = useStore((s) => s.addSource);
  const updateSource = useStore((s) => s.updateSource);
  const removeSource = useStore((s) => s.removeSource);

  const isEdit = !!initial;
  const [modelId, setModelId] = useState(
    initial?.modelId ?? equipment[0]?.id ?? '',
  );
  const [mounting, setMounting] = useState<MountingType>(
    initial?.mounting ?? defaultMounting ?? 'wall',
  );
  const [hs, setHs] = useState(initial?.hs ?? defaultHs ?? 1.5);
  const [count, setCount] = useState(initial?.count ?? 1);
  const [mode, setMode] = useState<OperatingMode>(initial?.mode ?? 'both');

  const submit = () => {
    if (isEdit && initial) {
      updateSource(initial.id, { modelId, mounting, hs, count, mode });
    } else {
      const src: Source = {
        id: `src-${Date.now().toString(36)}`,
        lat: lat ?? 0,
        lng: lng ?? 0,
        hs,
        mounting,
        count,
        modelId,
        mode,
      };
      addSource(src);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t(isEdit ? 'source.title.edit' : 'source.title.add')}</h3>

        <label>
          {t('source.model')}
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {equipment.map((eq: EquipmentModel) => (
              <option key={eq.id} value={eq.id}>
                {eq.brand} — {eq.model} ({eq.lwA} dBA)
              </option>
            ))}
          </select>
        </label>

        <label>
          {t('source.mounting')}
          <select
            value={mounting}
            onChange={(e) => setMounting(e.target.value as MountingType)}
          >
            <option value="free">{t('source.mounting.free')}</option>
            <option value="wall">{t('source.mounting.wall')}</option>
            <option value="corner">{t('source.mounting.corner')}</option>
          </select>
        </label>

        <label>
          {t('source.height')}
          <input
            type="number"
            value={hs}
            step={0.1}
            min={0}
            onChange={(e) => setHs(Number(e.target.value))}
          />
        </label>

        <label>
          {t('source.count')}
          <input
            type="number"
            value={count}
            min={1}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
          />
        </label>

        <label>
          {t('source.mode')}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as OperatingMode)}
          >
            <option value="both">{t('source.mode.both')}</option>
            <option value="day">{t('source.mode.day')}</option>
            <option value="night">{t('source.mode.night')}</option>
          </select>
        </label>

        <div className="modal-actions">
          {isEdit && initial ? (
            <button
              type="button"
              className="danger"
              onClick={() => {
                removeSource(initial.id);
                onClose();
              }}
            >
              🗑
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            {t('source.cancel')}
          </button>
          <button type="button" className="primary" onClick={submit}>
            {t('source.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
