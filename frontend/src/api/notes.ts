// Notes 消费端（MVP-01）。
//
// Contract 现状（登记，不阻塞）：notes 端点后端注解为 `-> dict`，OpenAPI 响应体
// 因此是自由 `{[key: string]: unknown}`（请求体 NoteCreate/NotePatch 已强类型）。
// 本模块是**唯一**的响应窄化位置：对 UI 实际消费的字段做运行时校验后投影为
// 本地视图类型——不是第二契约源，形状以 backend 实际返回为准；后端补
// response model 后，此处的窄化可整体退化为直用生成类型。
// 绕过本模块直接 `as` 断言响应字段视为违反 L2。
import { api, ApiError } from "./client";

export interface NoteSummary {
  id: number;
  title: string;
  path: string;
  tags: string[];
  updated_at: string;
  parent_id: number | null;
}

export interface NoteDetail extends NoteSummary {
  content_md: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string") {
    throw new ApiError(0, "contract_mismatch", `note.${field} 非字符串`);
  }
  return v;
}

function asSummary(v: unknown): NoteSummary {
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "note 响应非对象");
  }
  return {
    id: v.id as number,
    title: asString(v.title, "title"),
    path: asString(v.path, "path"),
    tags: Array.isArray(v.tags) ? (v.tags as string[]) : [],
    updated_at: asString(v.updated_at, "updated_at"),
    parent_id: (v.parent_id as number | null) ?? null,
  };
}

export async function listNotes(): Promise<NoteSummary[]> {
  const res = await api.get("/api/v1/notes");
  const notes = (res as { notes?: unknown }).notes;
  if (!Array.isArray(notes)) {
    throw new ApiError(0, "contract_mismatch", "notes 响应缺 notes 数组");
  }
  return notes.map(asSummary);
}

// schema 中 path 参数以 {note_id} 字面量为键；运行时替换后按原字面量类型回填，
// 使 wrapper 的 path-keyed 泛型仍生效。
type NotePath = "/api/v1/notes/{note_id}";
const NOTE_PATH: NotePath = "/api/v1/notes/{note_id}";
function notePath(noteId: number): NotePath {
  return NOTE_PATH.replace("{note_id}", String(noteId)) as NotePath;
}

export async function getNote(noteId: number): Promise<NoteDetail> {
  const res = await api.get(notePath(noteId));
  const note = (res as { note?: unknown }).note;
  const summary = asSummary(note);
  return { ...summary, content_md: asString((note as Record<string, unknown>).content_md, "content_md") };
}

export async function createNote(title: string, contentMd: string): Promise<NoteDetail> {
  const res = await api.post("/api/v1/notes", { title, content_md: contentMd });
  const note = (res as { note?: unknown }).note;
  const summary = asSummary(note);
  return { ...summary, content_md: asString((note as Record<string, unknown>).content_md, "content_md") };
}

export async function saveNoteContent(noteId: number, contentMd: string): Promise<NoteDetail> {
  // 只传 content_md：title/tags/parent 未传即不改（后端 NotePatch None 语义）
  const res = await api.patch(notePath(noteId), { content_md: contentMd });
  const note = (res as { note?: unknown }).note;
  const summary = asSummary(note);
  return { ...summary, content_md: asString((note as Record<string, unknown>).content_md, "content_md") };
}
