// Root component. Wires topbar, map, sidebar, worker, and PDF export.
//
// State flow:
//   sources/buildings/receivers live in the Zustand store.
//   Any change → schedule a worker calculation (100 ms debounce).
//   Worker responds with updated receivers + grid → store → components re-render.
//   Map centre change → useOverpass fetches new buildings (500 ms debounce).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPng } from 'html-to-image';
import { MapView } from './components/Map';
import { Sidebar } from './components/Sidebar';
import { SourceDialog } from './components/SourceDialog';
import { useStore } from './store/useStore';
import { useOverpass } from './hooks/useOverpass';
import { setLanguage as setI18nLang } from './i18n';
import { generatePDF } from './utils/pdfReport';
import type {
  BBox,
  Barrier,
  Building,
  Language,
  Source,
} from './engine/types';
import type {
  CalculationRequest,
  CalculationResponse,
} from './workers/calculation.worker';

const RECALC_DEBOUNCE_MS = 150;
const OVERPASS_DEBOUNCE_MS = 500;
const OVERPASS_RADIUS_M = 200;

function boundsOf(points: readonly [number, number][]): BBox | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  // Pad by 50 m so the grid extends beyond the sources.
  const padLat = 100 / 111_320;
  const padLng =
    100 /
    (111_320 * Math.cos((0.5 * (minLat + maxLat) * Math.PI) / 180));
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}

export default function App() {
  const { t, i18n } = useTranslation();

  const project = useStore((s) => s.project);
  const equipment = useStore((s) => s.equipment);
  const language = useStore((s) => s.language);
  const isCalculating = useStore((s) => s.isCalculating);
  const setLanguage = useStore((s) => s.setLanguage);
  const setBuildings = useStore((s) => s.setBuildings);
  const setReceivers = useStore((s) => s.setReceivers);
  const setCalculating = useStore((s) => s.setCalculating);
  const setGrid = useStore((s) => s.setGrid);
  const addBarrier = useStore((s) => s.addBarrier);
  const addBuilding = useStore((s) => s.addBuilding);

  const workerRef = useRef<Worker | null>(null);
  const jobCounter = useRef(0);
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overpassTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; kind: 'add'; lat: number; lng: number }
    | { open: true; kind: 'edit'; sourceId: string }
  >({ open: false });

  const overpass = useOverpass();

  // -------- language sync --------
  useEffect(() => {
    if (i18n.language !== language) setI18nLang(language);
  }, [language, i18n]);

  // -------- worker init --------
  useEffect(() => {
    const w = new Worker(
      new URL('./workers/calculation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    w.onmessage = (evt: MessageEvent<CalculationResponse>) => {
      const { jobId, receivers, grid } = evt.data;
      if (jobId !== jobCounter.current) return;
      setReceivers(receivers);
      if (grid) setGrid(grid);
      setCalculating(false);
    };
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, [setReceivers, setGrid, setCalculating]);

  // -------- overpass sync when center changes --------
  useEffect(() => {
    if (overpassTimer.current) clearTimeout(overpassTimer.current);
    overpassTimer.current = setTimeout(() => {
      void overpass.refresh(
        project.center[0],
        project.center[1],
        OVERPASS_RADIUS_M,
      );
    }, OVERPASS_DEBOUNCE_MS);
    return () => {
      if (overpassTimer.current) clearTimeout(overpassTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.center[0], project.center[1]]);

  useEffect(() => {
    if (overpass.buildings.length > 0) setBuildings(overpass.buildings);
  }, [overpass.buildings, setBuildings]);

  // -------- auto-recalculate --------
  const scheduleRecalc = useCallback(() => {
    if (!workerRef.current) return;
    if (recalcTimer.current) clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(() => {
      if (!workerRef.current) return;
      if (project.sources.length === 0 || project.receivers.length === 0) {
        setGrid([]);
        return;
      }
      jobCounter.current += 1;
      const jobId = jobCounter.current;
      const bbox = boundsOf(
        project.sources.map((s) => [s.lat, s.lng] as [number, number]),
      );
      const request: CalculationRequest = {
        jobId,
        sources: project.sources,
        receivers: project.receivers,
        buildings: project.buildings,
        barriers: project.barriers,
        equipment,
        grid: bbox ? { bbox, stepMeters: 8 } : undefined,
      };
      setCalculating(true);
      workerRef.current.postMessage(request);
    }, RECALC_DEBOUNCE_MS);
  }, [
    project.sources,
    project.receivers,
    project.buildings,
    project.barriers,
    equipment,
    setCalculating,
    setGrid,
  ]);

  useEffect(() => {
    scheduleRecalc();
    return () => {
      if (recalcTimer.current) clearTimeout(recalcTimer.current);
    };
  }, [scheduleRecalc]);

  // -------- callbacks --------
  const handleAddSource = useCallback((lat: number, lng: number) => {
    setDialogState({ open: true, kind: 'add', lat, lng });
  }, []);
  const handleAddReceiver = useCallback(
    (lat: number, lng: number) => {
      const id = `rcv-${Date.now().toString(36)}`;
      useStore.getState().addReceiver({ id, lat, lng, h: 1.5 });
    },
    [],
  );
  const handleAddBuilding = useCallback(
    (lat: number, lng: number) => {
      // MVP: a 6×6 m square footprint centred on the click, 6 m tall, protected.
      const half = 3 / 111_320;
      const halfLng = 3 / (111_320 * Math.cos((lat * Math.PI) / 180));
      const b: Building = {
        id: `manual-${Date.now().toString(36)}`,
        polygon: [
          [lat - half, lng - halfLng],
          [lat - half, lng + halfLng],
          [lat + half, lng + halfLng],
          [lat + half, lng - halfLng],
        ],
        height: 6,
        protected: true,
        source: 'manual',
      };
      addBuilding(b);
    },
    [addBuilding],
  );
  const handleAddBarrier = useCallback(
    (lat: number, lng: number) => {
      const halfLng = 10 / (111_320 * Math.cos((lat * Math.PI) / 180));
      const b: Barrier = {
        id: `bar-${Date.now().toString(36)}`,
        line: [
          [lat, lng - halfLng],
          [lat, lng + halfLng],
        ],
        height: 3,
      };
      addBarrier(b);
    },
    [addBarrier],
  );
  const handleSelectSource = useCallback((id: string) => {
    setDialogState({ open: true, kind: 'edit', sourceId: id });
  }, []);

  const editing: Source | undefined = useMemo(() => {
    if (dialogState.open && dialogState.kind === 'edit') {
      return project.sources.find((s) => s.id === dialogState.sourceId);
    }
    return undefined;
  }, [dialogState, project.sources]);

  // -------- Esc to cancel --------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialogState({ open: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleExportPdf = useCallback(async () => {
    const canvas = document.querySelector<HTMLDivElement>('.map-canvas');
    let dataUrl: string | null = null;
    if (canvas) {
      try {
        dataUrl = await toPng(canvas, { pixelRatio: 1.5 });
      } catch {
        dataUrl = null;
      }
    }
    const bytes = await generatePDF(project, equipment, dataUrl, {
      title: t('pdf.title'),
      generated: t('pdf.generated'),
      inputs: t('pdf.inputs'),
      results: t('pdf.results'),
      disclaimer: t('pdf.disclaimer'),
    });
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: 'application/pdf',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, equipment, t]);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">🔊 {t('app.title')}</span>
        <span className="muted">{isCalculating ? '…' : ''}</span>
        <div className="lang">
          {(['uk', 'pl', 'en'] as Language[]).map((l) => (
            <button
              key={l}
              type="button"
              className={language === l ? 'active' : ''}
              onClick={() => setLanguage(l)}
            >
              {t(`language.${l}`)}
            </button>
          ))}
        </div>
      </header>
      <div className="body">
        <MapView
          onAddSource={handleAddSource}
          onAddReceiver={handleAddReceiver}
          onDrawBuilding={handleAddBuilding}
          onSelectSource={handleSelectSource}
        />
        <Sidebar
          onAddSource={() =>
            setDialogState({
              open: true,
              kind: 'add',
              lat: project.center[0],
              lng: project.center[1],
            })
          }
          onEditSource={handleSelectSource}
          onExportPdf={() => void handleExportPdf()}
          onRecalculate={scheduleRecalc}
        />
      </div>
      {dialogState.open ? (
        <SourceDialog
          initial={editing}
          lat={dialogState.kind === 'add' ? dialogState.lat : undefined}
          lng={dialogState.kind === 'add' ? dialogState.lng : undefined}
          onClose={() => setDialogState({ open: false })}
        />
      ) : null}
      {/* Silence the unused-var warning for handleAddBarrier — surfaced later
          via keyboard shortcut or context menu extension. */}
      {false ? <button onClick={() => handleAddBarrier(0, 0)} /> : null}
    </div>
  );
}
