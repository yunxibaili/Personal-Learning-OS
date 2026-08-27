/** M7-005 同步冲突契约（pytest API 测试锁定）。 */

export interface ConflictItem {
  path: string; // 主文件，如 mind_maps/math.mindmap.json
  kind: string; // 当前恒为 "mindmap"
  local_path: string;
  remote_path: string;
  local_updated_at: string;
  remote_updated_at: string;
  local_preview: string;
  remote_preview: string;
}

export interface SyncStatusResponse {
  conflicts: ConflictItem[];
}

export type ConflictResolution = "keep_local" | "keep_remote";

export interface ResolveResponse {
  ok: boolean;
  message: string;
}
