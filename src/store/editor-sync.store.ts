import { create } from "zustand";

export type SyncState = "unloaded" | "loading" | "ready" | "stale";

type EditorSyncStore = {
  syncStates: Record<string, SyncState>;
  setSyncState: (fileId: string, state: SyncState) => void;
  clearSyncState: (fileId: string) => void;
};

export const useEditorSyncStore = create<EditorSyncStore>((set) => ({
  syncStates: {},
  setSyncState: (fileId, state) =>
    set((prev) => ({
      syncStates: {
        ...prev.syncStates,
        [fileId]: state,
      },
    })),
  clearSyncState: (fileId) =>
    set((prev) => {
      const syncStates = { ...prev.syncStates };
      delete syncStates[fileId];
      return { syncStates };
    }),
}));