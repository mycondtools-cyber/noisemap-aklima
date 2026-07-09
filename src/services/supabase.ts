// Minimal Supabase integration for saving/loading projects.
// The user provides SUPABASE_URL and SUPABASE_ANON_KEY via env vars; if not
// configured, save/load falls back to localStorage so the app still works.

import type { ProjectSnapshot } from '../types';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;
const LOCAL_KEY = 'aklima:projects';

function localGet(): Record<string, ProjectSnapshot> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProjectSnapshot>) : {};
  } catch {
    return {};
  }
}

function localSet(data: Record<string, ProjectSnapshot>): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export async function saveProject(
  id: string,
  snapshot: ProjectSnapshot,
): Promise<{ id: string; storage: 'supabase' | 'local' }> {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ id, snapshot }),
    });
    if (res.ok) return { id, storage: 'supabase' };
  }
  const store = localGet();
  store[id] = snapshot;
  localSet(store);
  return { id, storage: 'local' };
}

export async function loadProject(id: string): Promise<ProjectSnapshot | null> {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=snapshot`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );
    if (res.ok) {
      const rows = (await res.json()) as { snapshot: ProjectSnapshot }[];
      if (rows.length > 0) return rows[0].snapshot;
    }
  }
  const store = localGet();
  return store[id] ?? null;
}

export function listLocalProjects(): { id: string; name: string }[] {
  const store = localGet();
  return Object.entries(store).map(([id, snapshot]) => ({
    id,
    name: snapshot.name,
  }));
}
