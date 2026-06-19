"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface ProviderEntryShape {
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  models?: Array<{ id: string }>;
}

interface RemoteModel {
  id: string;
  name?: string;
}

interface FetchModelsDialogProps {
  providerName: string;
  provider: ProviderEntryShape;
  existingModelIds: Set<string>;
  onClose: () => void;
  onImport: (ids: string[]) => void;
}

export default function FetchModelsDialog({
  providerName,
  provider,
  existingModelIds,
  onClose,
  onImport,
}: FetchModelsDialogProps) {
  const ft = useTranslations("models");
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [models, setModels] = useState<RemoteModel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/models-config/list-remote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerName, provider }),
        });
        const data = (await res.json()) as { ok?: boolean; models?: RemoteModel[]; error?: string };
        if (aborted) return;
        if (!res.ok || !data.ok) {
          setPhase("error");
          setErrorMessage(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const list = data.models ?? [];
        setModels(list);
        // Pre-select everything not yet imported, so a single click on Import
        // pulls in all new models without manual ticking.
        const initial = new Set<string>();
        for (const m of list) {
          if (!existingModelIds.has(m.id)) initial.add(m.id);
        }
        setSelected(initial);
        setPhase("ready");
      } catch (error) {
        if (aborted) return;
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => { aborted = true; };
  }, [providerName, provider, existingModelIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) =>
      m.id.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q),
    );
  }, [models, query]);

  const importable = filtered.filter((m) => !existingModelIds.has(m.id));
  const allFilteredImportableSelected =
    importable.length > 0 && importable.every((m) => selected.has(m.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of importable) next.add(m.id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const importSelected = () => {
    const ids = Array.from(selected).filter((id) => !existingModelIds.has(id));
    if (ids.length === 0) {
      onClose();
      return;
    }
    onImport(ids);
    onClose();
  };

  const importCount = Array.from(selected).filter((id) => !existingModelIds.has(id)).length;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 580, maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {ft("fetchModelsTitle", { provider: providerName })}
          </div>
          {phase === "ready" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {ft("fetchModelsDescription", { count: models.length })}
            </div>
          )}
        </div>

        {phase === "loading" && (
          <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ft("fetching")}
          </div>
        )}

        {phase === "error" && (
          <div style={{ padding: "16px 18px", color: "#f87171", fontSize: 12, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {ft("fetchFailed")}: {errorMessage}
          </div>
        )}

        {phase === "ready" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ft("fetchSearchPlaceholder")}
                style={{
                  flex: 1, padding: "5px 8px",
                  background: "var(--bg-panel)", border: "1px solid var(--border)",
                  borderRadius: 5, color: "var(--text)", fontSize: 12, outline: "none",
                }}
              />
              <button
                onClick={allFilteredImportableSelected ? clearSelection : selectAllFiltered}
                style={{ padding: "5px 10px", background: "none", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}
              >
                {allFilteredImportableSelected ? ft("fetchSelectNone") : ft("fetchSelectAll")}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>{ft("fetchEmpty")}</div>
              ) : filtered.map((m) => {
                const already = existingModelIds.has(m.id);
                const checked = already || selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", borderRadius: 5,
                      cursor: already ? "default" : "pointer",
                      opacity: already ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => { if (!already) e.currentTarget.style.background = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={already}
                      onChange={() => toggle(m.id)}
                    />
                    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.id}
                    </span>
                    {m.name && m.name !== m.id && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    )}
                    {already && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)", padding: "1px 6px", border: "1px solid var(--border)", borderRadius: 3 }}>{ft("fetchAlreadyAdded")}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            style={{ padding: "6px 14px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
          >
            {ft("cancel")}
          </button>
          <button
            onClick={importSelected}
            disabled={phase !== "ready" || importCount === 0}
            style={{
              padding: "6px 16px",
              background: phase === "ready" && importCount > 0 ? "var(--accent)" : "var(--bg-panel)",
              color: phase === "ready" && importCount > 0 ? "#fff" : "var(--text-dim)",
              border: "none", borderRadius: 6,
              cursor: phase === "ready" && importCount > 0 ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600,
            }}
          >
            {ft("fetchImport", { count: importCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
