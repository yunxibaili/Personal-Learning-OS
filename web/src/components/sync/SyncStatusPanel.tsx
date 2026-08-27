import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPost } from "../../lib/api";
import type {
  ConflictItem,
  ResolveResponse,
  SyncStatusResponse,
} from "@shared/types/sync";

/**
 * SyncStatusPanel（M7-005）：
 * 低打扰同步反馈——只读状态 + 冲突裁决（Keep Local / Keep Remote / Compare 展开）。
 * ADR-022：Sync 是基础设施，不弹窗、不提醒、不自动解决。
 */
export function SyncStatusPanel() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string>("");
  const [busyPath, setBusyPath] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const s = await apiGet<SyncStatusResponse>("/sync/status");
      setConflicts(s.conflicts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resolve = useCallback(async (path: string, resolution: "keep_local" | "keep_remote") => {
    setBusyPath(path);
    try {
      await apiPost<ResolveResponse>("/sync/resolve", { path, resolution });
      if (expanded === path) setExpanded("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPath("");
    }
  }, [expanded, load]);

  return (
    <div className="dash-section sync-panel">
      <h3>Sync</h3>
      {error && <div className="error-banner">{error}</div>}

      {conflicts.length === 0 && !error && (
        <p className="muted">无冲突 · 同步状态正常</p>
      )}

      {conflicts.map((c) => (
        <div key={c.path} className="sync-conflict">
          <div className="sync-conflict-head">
            <span className="sync-title">{c.path.replace("mind_maps/", "").replace(".mindmap.json", "")}</span>
            <span className="muted">
              local: {c.local_updated_at || "—"} · remote: {c.remote_updated_at || "—"}
            </span>
          </div>

          {expanded === c.path && (
            <div className="sync-compare">
              <div className="sync-side">
                <strong>Local</strong>
                <pre>{c.local_preview || "(empty)"}</pre>
              </div>
              <div className="sync-side">
                <strong>Remote</strong>
                <pre>{c.remote_preview || "(empty)"}</pre>
              </div>
            </div>
          )}

          <div className="sync-actions">
            <button
              onClick={() => setExpanded(expanded === c.path ? "" : c.path)}
            >
              {expanded === c.path ? "Hide" : "Compare"}
            </button>
            <button
              disabled={busyPath === c.path}
              onClick={() => void resolve(c.path, "keep_local")}
            >
              Keep Local
            </button>
            <button
              disabled={busyPath === c.path}
              onClick={() => void resolve(c.path, "keep_remote")}
            >
              Keep Remote
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
