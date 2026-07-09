import { useTranslation } from 'react-i18next';

export type MapTool = 'select' | 'source' | 'receiver' | 'building' | 'barrier';

interface Props {
  tool: MapTool;
  onChange: (tool: MapTool) => void;
}

const TOOLS: { key: MapTool; label: string }[] = [
  { key: 'select', label: 'Select' },
  { key: 'source', label: 'Source' },
  { key: 'receiver', label: 'Receiver' },
  { key: 'building', label: 'Building' },
  { key: 'barrier', label: 'Barrier' },
];

export default function MapToolbar({ tool, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tool-menu" role="toolbar" aria-label={t('sidebar.sources')}>
      {TOOLS.map((tItem) => (
        <button
          key={tItem.key}
          className={tool === tItem.key ? 'active' : ''}
          onClick={() => onChange(tItem.key)}
          type="button"
        >
          {tItem.label}
        </button>
      ))}
    </div>
  );
}
