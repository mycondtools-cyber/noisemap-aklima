// PDF report generation using pdf-lib + html-to-image.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { toPng } from 'html-to-image';
import equipment from '../../data/equipment.json';
import type {
  EquipmentModel,
  ProjectSnapshot,
  CalculationResults,
} from '../../types';

const EQUIPMENT = equipment as EquipmentModel[];

interface GenerateOptions {
  mapEl: HTMLElement | null;
  snapshot: ProjectSnapshot;
  results: CalculationResults | null;
  lang: string;
  strings: {
    title: string;
    generated: string;
    inputs: string;
    resultsHeader: string;
    method: string;
    methodBody: string;
    disclaimer: string;
  };
}

async function captureMap(mapEl: HTMLElement | null): Promise<Uint8Array | null> {
  if (!mapEl) return null;
  try {
    const dataUrl = await toPng(mapEl, { cacheBust: true });
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function findEquipment(id: string): EquipmentModel | undefined {
  return EQUIPMENT.find((m) => m.id === id);
}

export async function generateReport(opts: GenerateOptions): Promise<Uint8Array> {
  const { mapEl, snapshot, results, strings } = opts;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Title page.
  const page1 = pdf.addPage([595, 842]); // A4 portrait
  page1.drawText(strings.title, {
    x: 40,
    y: 780,
    size: 20,
    font: bold,
    color: rgb(0.05, 0.1, 0.2),
  });
  page1.drawText(`${strings.generated}: ${new Date().toLocaleString(opts.lang)}`, {
    x: 40,
    y: 750,
    size: 10,
    font,
  });
  page1.drawText(`Project: ${snapshot.name}`, {
    x: 40,
    y: 730,
    size: 12,
    font,
  });

  const mapImage = await captureMap(mapEl);
  if (mapImage) {
    const img = await pdf.embedPng(mapImage);
    const maxW = 515;
    const maxH = 380;
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * ratio;
    const h = img.height * ratio;
    page1.drawImage(img, { x: 40, y: 340, width: w, height: h });
  }

  page1.drawText(strings.disclaimer, {
    x: 40,
    y: 40,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
    maxWidth: 515,
  });

  // Inputs page.
  const page2 = pdf.addPage([595, 842]);
  page2.drawText(strings.inputs, { x: 40, y: 800, size: 14, font: bold });
  let y = 770;
  page2.drawText('Sources', { x: 40, y, size: 11, font: bold });
  y -= 14;
  for (const s of snapshot.sources) {
    const eq = findEquipment(s.modelId);
    const line = `- ${eq ? `${eq.brand} ${eq.model}` : s.modelId} · Lw=${eq?.lwA ?? '?'} dBA · h=${s.hs} m · ${s.mounting} · ×${s.count}`;
    page2.drawText(line, { x: 50, y, size: 10, font });
    y -= 12;
    if (y < 60) break;
  }

  y -= 8;
  page2.drawText('Buildings', { x: 40, y, size: 11, font: bold });
  y -= 14;
  for (const b of snapshot.buildings.slice(0, 20)) {
    const line = `- ${b.osmId ? `OSM #${b.osmId}` : b.id.slice(0, 8)} · h=${b.height.toFixed(1)} m · ${b.protected ? 'protected' : 'neutral'}`;
    page2.drawText(line, { x: 50, y, size: 10, font });
    y -= 12;
    if (y < 60) break;
  }

  // Results page.
  const page3 = pdf.addPage([595, 842]);
  page3.drawText(strings.resultsHeader, { x: 40, y: 800, size: 14, font: bold });
  y = 770;
  page3.drawText(
    'Receiver          Distance   Day   Night   Limit   Status',
    { x: 40, y, size: 10, font: bold },
  );
  y -= 14;
  if (results?.receivers) {
    for (const r of results.receivers.slice(0, 40)) {
      const line = `${r.receiverId.slice(0, 14).padEnd(16)}${r.distance.toFixed(1).padStart(8)}${r.dBAday.toFixed(1).padStart(8)}${r.dBAnight.toFixed(1).padStart(8)}${String(r.normLimit).padStart(8)}   ${r.status}`;
      page3.drawText(line, { x: 40, y, size: 9, font });
      y -= 11;
      if (y < 120) break;
    }
  }

  // Methodology page.
  const page4 = pdf.addPage([595, 842]);
  page4.drawText(strings.method, { x: 40, y: 800, size: 14, font: bold });
  page4.drawText(strings.methodBody, {
    x: 40,
    y: 700,
    size: 10,
    font,
    maxWidth: 515,
    lineHeight: 14,
  });
  page4.drawText(strings.disclaimer, {
    x: 40,
    y: 100,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
    maxWidth: 515,
  });

  return pdf.save();
}

export function downloadBlob(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
