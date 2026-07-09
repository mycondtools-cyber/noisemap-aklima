// Client-side PDF report using pdf-lib. Multi-page:
//   1. Cover — title, project name, date, map screenshot.
//   2. Inputs — sources table (model, mounting, height, count).
//   3. Results — receiver-by-receiver table with day/night status.
// Footer on every page repeats the ISO 9613-2 disclaimer.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Project, EquipmentModel } from '../engine/types';

interface I18nStrings {
  title: string;
  generated: string;
  inputs: string;
  results: string;
  disclaimer: string;
}

const DEFAULT_STRINGS: I18nStrings = {
  title: 'NoiseMap Aklima — Acoustic Report',
  generated: 'Generated',
  inputs: 'Input data',
  results: 'Calculation results',
  disclaimer:
    'Calculated per ISO 9613-2. Expected uncertainty ±3 dB. © Aklima',
};

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function statusOf(
  Lp: number,
  limit: number,
): { label: 'OK' | 'WARN' | 'FAIL'; color: [number, number, number] } {
  if (!Number.isFinite(Lp)) return { label: 'OK', color: [0.18, 0.49, 0.20] };
  if (Lp > limit) return { label: 'FAIL', color: [0.78, 0.16, 0.16] };
  if (Lp > limit - 5) return { label: 'WARN', color: [0.98, 0.66, 0.14] };
  return { label: 'OK', color: [0.18, 0.49, 0.20] };
}

async function embedMap(
  pdf: PDFDocument,
  mapImageBase64: string | null,
) {
  if (!mapImageBase64) return null;
  const dataUrl = mapImageBase64.startsWith('data:')
    ? mapImageBase64
    : `data:image/png;base64,${mapImageBase64}`;
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) =>
    c.charCodeAt(0),
  );
  try {
    return await pdf.embedPng(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

export async function generatePDF(
  project: Project,
  equipment: readonly EquipmentModel[],
  mapImageBase64: string | null,
  strings: Partial<I18nStrings> = {},
): Promise<Uint8Array> {
  const s: I18nStrings = { ...DEFAULT_STRINGS, ...strings };
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mapImg = await embedMap(pdf, mapImageBase64);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const addFooter = (page: ReturnType<PDFDocument['addPage']>) => {
    page.drawText(s.disclaimer, {
      x: 40,
      y: 24,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  };

  // -------- Page 1: cover + map --------
  const cover = pdf.addPage([595, 842]); // A4 portrait
  cover.drawText(s.title, { x: 40, y: 800, size: 20, font: bold });
  cover.drawText(`${project.name}`, { x: 40, y: 774, size: 14, font });
  cover.drawText(`${s.generated}: ${now}`, {
    x: 40,
    y: 754,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  cover.drawText(
    `${project.norms.country} · day ${project.norms.dayLimit} dBA · night ${project.norms.nightLimit} dBA`,
    { x: 40, y: 738, size: 10, font },
  );
  if (mapImg) {
    const maxW = 515;
    const maxH = 420;
    const ratio = Math.min(maxW / mapImg.width, maxH / mapImg.height);
    const w = mapImg.width * ratio;
    const h = mapImg.height * ratio;
    cover.drawImage(mapImg, { x: 40, y: 720 - h, width: w, height: h });
  }
  addFooter(cover);

  // -------- Page 2: input data --------
  const inputs = pdf.addPage([595, 842]);
  inputs.drawText(s.inputs, { x: 40, y: 800, size: 16, font: bold });
  const headerY = 770;
  const rowStep = 18;
  const columns = ['#', 'Model', 'Mounting', 'H (m)', 'Count', 'Mode'];
  const colX = [40, 80, 260, 350, 400, 450];
  columns.forEach((c, i) =>
    inputs.drawText(c, { x: colX[i], y: headerY, size: 10, font: bold }),
  );
  project.sources.forEach((src, i) => {
    const eq = equipment.find((e) => e.id === src.modelId);
    const y = headerY - (i + 1) * rowStep;
    const cells = [
      `${i + 1}`,
      eq ? `${eq.brand} ${eq.model}` : src.modelId,
      src.mounting,
      fmt(src.hs),
      `${src.count}`,
      src.mode,
    ];
    cells.forEach((v, j) =>
      inputs.drawText(v, { x: colX[j], y, size: 9, font }),
    );
  });
  addFooter(inputs);

  // -------- Page 3+: results --------
  const results = pdf.addPage([595, 842]);
  results.drawText(s.results, { x: 40, y: 800, size: 16, font: bold });
  const rHeaderY = 770;
  const rCols = [
    '#',
    'Building',
    'Day',
    'Lim',
    'St.',
    'Night',
    'Lim',
    'St.',
  ];
  const rColX = [40, 70, 240, 290, 320, 360, 410, 440];
  rCols.forEach((c, i) =>
    results.drawText(c, { x: rColX[i], y: rHeaderY, size: 10, font: bold }),
  );
  const sorted = [...project.receivers].sort((a, b) => {
    const av = Math.max(a.results?.LpA_day ?? 0, a.results?.LpA_night ?? 0);
    const bv = Math.max(b.results?.LpA_day ?? 0, b.results?.LpA_night ?? 0);
    return bv - av;
  });
  sorted.slice(0, 40).forEach((r, i) => {
    const y = rHeaderY - (i + 1) * 15;
    const day = r.results?.LpA_day ?? NaN;
    const night = r.results?.LpA_night ?? NaN;
    const dayStatus = statusOf(day, project.norms.dayLimit);
    const nightStatus = statusOf(night, project.norms.nightLimit);
    results.drawText(`${i + 1}`, { x: rColX[0], y, size: 9, font });
    results.drawText((r.buildingId ?? '—').slice(0, 22), {
      x: rColX[1],
      y,
      size: 9,
      font,
    });
    results.drawText(fmt(day), { x: rColX[2], y, size: 9, font });
    results.drawText(`${project.norms.dayLimit}`, {
      x: rColX[3],
      y,
      size: 9,
      font,
    });
    results.drawText(dayStatus.label, {
      x: rColX[4],
      y,
      size: 9,
      font: bold,
      color: rgb(...dayStatus.color),
    });
    results.drawText(fmt(night), { x: rColX[5], y, size: 9, font });
    results.drawText(`${project.norms.nightLimit}`, {
      x: rColX[6],
      y,
      size: 9,
      font,
    });
    results.drawText(nightStatus.label, {
      x: rColX[7],
      y,
      size: 9,
      font: bold,
      color: rgb(...nightStatus.color),
    });
  });
  addFooter(results);

  return pdf.save();
}
