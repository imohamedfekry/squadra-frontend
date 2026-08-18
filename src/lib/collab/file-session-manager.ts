import {
  HocuspocusProvider,
  type onStatusParameters,
  type onSyncedParameters,
} from "@hocuspocus/provider";
import * as Y from "yjs";
import {
  useEditorSyncStore,
  type SyncState,
} from "@/store/editor-sync.store";

const MAX_SESSIONS = 20;

const HOCUSPOCUS_URL =
  process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ??
  "ws://localhost:3001/collaboration";

export interface FileSession {
  fileId: string;
  projectId: string;
  doc: Y.Doc;
  yText: Y.Text;
  provider: HocuspocusProvider;
  status: SyncState;
  lastUsed: number;
}

const sessions = new Map<string, FileSession>();
const activeRefs = new Map<string, number>();

function setSessionStatus(session: FileSession, status: SyncState) {
  session.status = status;
  useEditorSyncStore.getState().setSyncState(session.fileId, status);
}

function wireStatus(session: FileSession) {
  session.provider.on("status", ({ status }: onStatusParameters) => {
    if (status === "connecting") {
      setSessionStatus(session, "loading");
    } else if (status === "disconnected") {
      setSessionStatus(session, "stale");
    }
  });

  session.provider.on("synced", ({ state }: onSyncedParameters) => {
    if (state) {
      setSessionStatus(session, "ready");
    }
  });
}

function disposeSession(fileId: string) {
  const session = sessions.get(fileId);
  if (!session) return;

  sessions.delete(fileId);
  activeRefs.delete(fileId);
  session.provider.destroy();
  session.doc.destroy();
  useEditorSyncStore.getState().clearSyncState(fileId);
}

function evictIfNeeded() {
  if (sessions.size <= MAX_SESSIONS) return;

  const candidates = [...sessions.values()]
    .filter((session) => (activeRefs.get(session.fileId) ?? 0) === 0)
    .sort((a, b) => a.lastUsed - b.lastUsed);

  for (const session of candidates) {
    if (sessions.size <= MAX_SESSIONS) break;
    disposeSession(session.fileId);
  }
}

export const fileSessionManager = {
  getOrCreate(fileId: string, projectId: string): FileSession {
    const existing = sessions.get(fileId);
    if (existing) {
      existing.lastUsed = Date.now();
      activeRefs.set(fileId, (activeRefs.get(fileId) ?? 0) + 1);
      return existing;
    }

    const doc = new Y.Doc();
    const yText = doc.getText("content");
    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_URL,
      name: `project:${projectId}:file:${fileId}`,
      document: doc,
    });

    const session: FileSession = {
      fileId,
      projectId,
      doc,
      yText,
      provider,
      status: "loading",
      lastUsed: Date.now(),
    };

    sessions.set(fileId, session);
    activeRefs.set(fileId, 1);
    useEditorSyncStore.getState().setSyncState(fileId, "loading");
    wireStatus(session);
    evictIfNeeded();
    return session;
  },

  getSession(fileId: string): FileSession | undefined {
    return sessions.get(fileId);
  },

  markActive(fileId: string) {
    const session = sessions.get(fileId);
    if (session) {
      session.lastUsed = Date.now();
    }
  },

  release(fileId: string) {
    const refs = activeRefs.get(fileId) ?? 0;
    if (refs <= 1) {
      activeRefs.delete(fileId);
    } else {
      activeRefs.set(fileId, refs - 1);
    }
  },

  dispose(fileId: string) {
    disposeSession(fileId);
  },

  disposeProject(projectId: string) {
    for (const session of [...sessions.values()]) {
      if (session.projectId === projectId) {
        disposeSession(session.fileId);
      }
    }
  },
};