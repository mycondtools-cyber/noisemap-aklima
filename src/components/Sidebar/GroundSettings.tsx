import { useStore } from '../../store';

export default function GroundSettings() {
  const G = useStore((s) => s.groundFactor);
  const setG = useStore((s) => s.setGroundFactor);
  return (
    <div>
      <label>
        Ground factor G: <strong>{G.toFixed(2)}</strong>
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={G}
        onChange={(e) => setG(parseFloat(e.target.value))}
      />
      <div style={{ fontSize: 11, color: '#64748b' }}>
        0 = hard (asphalt), 0.5 = mixed, 1 = soft (grass)
      </div>
    </div>
  );
}
