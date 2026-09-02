/**
 * SettingsView（P1-5-A）：LLM Provider 配置页。
 *
 * 数据流：GET /api/v1/settings（敏感键脱敏为 ******）→ 表单 →
 * PUT /api/v1/settings（只下发变化的键，脱敏值绝不回写——见 settingsPatch.ts）。
 *
 * 定位：**P1-4（MockProvider 演示路径）的硬前置**——没有这个页，用户无法把
 * 默认 MockProvider 切成真实 LLM，Tutor 永远只能演示。
 *
 * 边界（P1-5 裁定）：只做 LLM Provider 配置，不做同步管理（延 M8）、
 * 不做全量导出/导入（backend-only）。
 */
import { useCallback, useEffect, useState } from "react";

import { getSettings, saveSettings } from "../lib/api";
import { Badge, Button, Input, Select, Skeleton, useToast } from "../components/ui";
import {
  DEFAULT_FORM,
  MASKED,
  buildSettingsPatch,
  validateForm,
  type SettingsForm,
} from "./settingsPatch";

const PROVIDER_OPTIONS = [
  { value: "mock", label: "Mock（内置演示，不联网）" },
  { value: "openai_compat", label: "OpenAI 兼容端点（Ollama / DeepSeek / 国产大模型）" },
];

export function SettingsView() {
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [loaded, setLoaded] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");

  const set = useCallback(<K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((d) => {
        if (!alive) return;
        const s = d.settings ?? {};
        setLoaded(s);
        setForm({
          provider: s["llm.provider"] || DEFAULT_FORM.provider,
          baseUrl: s["llm.base_url"] ?? "",
          // 脱敏值不进表单（避免用户以为星号就是当前值、或误存星号）
          apiKey: s["llm.api_key"] === MASKED ? "" : (s["llm.api_key"] ?? ""),
          model: s["llm.model"] ?? "",
          fastModel: s["llm.fast_model"] ?? "",
          maxTokens: s["llm.max_tokens"] ?? "",
        });
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const hasSavedKey = loaded["llm.api_key"] === MASKED;

  const onSave = useCallback(async () => {
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const patch = buildSettingsPatch(form, loaded);
    if (Object.keys(patch).length === 0) {
      toast.push("没有需要保存的改动", "neutral");
      return;
    }
    setSaving(true);
    try {
      await saveSettings(patch);
      setLoaded((prev) => ({ ...prev, ...patch }));
      toast.push("设置已保存", "ok", Object.keys(patch).join("、"));
      // 保存后清掉输入框里的密钥（不留在内存/不随后续误操作再次下发）
      if (patch["llm.api_key"] !== undefined) {
        setForm((prev) => ({ ...prev, apiKey: "" }));
        setLoaded((prev) => ({ ...prev, "llm.api_key": MASKED }));
      }
    } catch (e) {
      toast.push("保存失败", "err", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form, loaded, toast]);

  const isMock = form.provider === "mock";

  return (
    <div className="settings-view">
      <h1 className="settings-view__h1">设置</h1>

      {loadError && (
        <p className="settings-view__error" role="alert">设置加载失败：{loadError}</p>
      )}

      {loading ? (
        <div className="settings-view__panel" aria-busy="true">
          <Skeleton width="40%" />
          <Skeleton />
          <Skeleton />
          <Skeleton width="60%" />
        </div>
      ) : (
        <section className="settings-view__panel">
          <header className="settings-view__head">
            <h2>AI 模型（LLM Provider）</h2>
            <Badge tone={isMock ? "warn" : "ok"}>
              {isMock ? "当前：Mock（演示）" : "当前：OpenAI 兼容"}
            </Badge>
          </header>
          <p className="settings-view__desc">
            默认使用内置 MockProvider——对话链路完整可跑，但回答是占位文本。
            填入一个 OpenAI 兼容端点（本地 Ollama <code>http://127.0.0.1:11434/v1</code>、
            DeepSeek 等）即可切换为真实模型。密钥只存在本地，界面永不回显。
          </p>

          <Select
            label="Provider"
            options={PROVIDER_OPTIONS}
            value={form.provider}
            onChange={(e) => set("provider", e.target.value)}
          />

          <Input
            label="Base URL"
            placeholder={isMock ? "Mock 模式无需填写" : "http://127.0.0.1:11434/v1"}
            value={form.baseUrl}
            disabled={isMock}
            error={errors.baseUrl}
            hint={isMock ? "切换到 OpenAI 兼容模式后可填" : undefined}
            onChange={(e) => set("baseUrl", e.target.value)}
          />

          <Input
            label="API Key"
            type="password"
            autoComplete="off"
            placeholder={hasSavedKey ? "已保存（不修改请留空）" : "本地 Ollama 可留空"}
            value={form.apiKey}
            hint={hasSavedKey ? "留空 = 保持已保存的密钥" : undefined}
            onChange={(e) => set("apiKey", e.target.value)}
          />

          <Input
            label="模型名"
            placeholder="qwen3:14b / deepseek-chat"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
          />

          <Input
            label="辅助模型（可选）"
            placeholder="留空则回退主模型"
            hint="抽取器等低成本调用使用（ADR-003）"
            value={form.fastModel}
            onChange={(e) => set("fastModel", e.target.value)}
          />

          <Input
            label="单次补全 token 预算"
            inputMode="numeric"
            placeholder="留空 = 后端默认"
            value={form.maxTokens}
            error={errors.maxTokens}
            onChange={(e) => set("maxTokens", e.target.value)}
          />

          <div className="settings-view__actions">
            <Button variant="primary" onClick={() => void onSave()} disabled={saving}>
              {saving ? "保存中…" : "保存设置"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
