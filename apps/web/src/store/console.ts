import { create } from 'zustand';
import type { EventStatus } from '@hookrelay/shared';

export type Workspace = 'sandbox' | 'mine';

interface ConsoleState {
  workspace: Workspace;
  paused: boolean;
  status: EventStatus | 'ALL';
  search: string;
  selectedId: string | null;
  dlqSelection: string[];
  setWorkspace: (w: Workspace) => void;
  togglePaused: () => void;
  setStatus: (s: EventStatus | 'ALL') => void;
  setSearch: (s: string) => void;
  select: (id: string | null) => void;
  toggleDlq: (id: string) => void;
  setDlqSelection: (ids: string[]) => void;
}

export const useConsole = create<ConsoleState>((set) => ({
  workspace: 'sandbox',
  paused: false,
  status: 'ALL',
  search: '',
  selectedId: null,
  dlqSelection: [],
  setWorkspace: (workspace) => set({ workspace, selectedId: null, dlqSelection: [] }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setStatus: (status) => set({ status }),
  setSearch: (search) => set({ search }),
  select: (selectedId) => set({ selectedId }),
  toggleDlq: (id) => set((s) => ({ dlqSelection: s.dlqSelection.includes(id) ? s.dlqSelection.filter((x) => x !== id) : [...s.dlqSelection, id] })),
  setDlqSelection: (dlqSelection) => set({ dlqSelection }),
}));

/** `sandbox=true` unless the signed-in user switched to their own sources. */
export const useSandboxFlag = () => useConsole((s) => s.workspace === 'sandbox');
