"use client";

import { useMemo, useState } from "react";

type ImportType = "FLA" | "FLQA";

export default function UploadClient() {
  const [type, setType] = useState<ImportType>("FLA");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  const canGo = useMemo(() => !!file && !busy, [file, busy]);

  async function run() {
    if (!file) return;
    setBusy(true);
    setLog("");

    try {
      // 1) Upload via backend (/api/import)
      setLog("Uploading file…");

      const form = new FormData();
      form.append("type", type);
      form.append("file", file);

      const importRes = await fetch("/api/import", {
        method: "POST",
        body: form,
      });

      const importText = await importRes.text();
      let imported: any;
      try {
        imported = JSON.parse(importText);
      } catch {
        throw new Error(
          `API /api/import returned non-JSON (${importRes.status}): ${importText.slice(
            0,
            120
          )}...`
        );
      }

      if (!importRes.ok || imported?.error) {
        throw new Error(imported?.error ?? `Upload failed (${importRes.status}).`);
      }

      // 2) Process latest
      setLog("Processing latest…");
      const processedRes = await fetch(`/api/process/latest?type=${type}`, {
        method: "POST",
      });

      const processedText = await processedRes.text();
      let processed: any;
      try {
        processed = JSON.parse(processedText);
      } catch {
        throw new Error(
          `API /api/process/latest returned non-JSON (${processedRes.status}): ${processedText.slice(
            0,
            120
          )}...`
        );
      }

      if (!processedRes.ok || processed?.error) {
        throw new Error(processed?.error ?? `Process failed (${processedRes.status}).`);
      }

      setLog(
        `OK ✅ import: ${imported.path ?? "(no path)"} | processed: import_id=${processed.import_id} snapshot_id=${processed.snapshot_id} rows=${processed.rows} diff_events=${processed.diff_events}`
      );
    } catch (e: any) {
      setLog(`Erro ❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Tipo:</label>
        <select
          className="border rounded px-2 py-1"
          value={type}
          onChange={(e) => setType(e.target.value as ImportType)}
          disabled={busy}
        >
          <option value="FLA">FLA</option>
          <option value="FLQA">FLQA</option>
        </select>

        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button
          className="border rounded px-3 py-1 disabled:opacity-50"
          disabled={!canGo}
          onClick={run}
        >
          Upload + Processar
        </button>

        <a className="underline text-sm" href={`/dashboard?type=${type}`}>
          Abrir dashboard ({type})
        </a>
      </div>

      <pre className="text-xs p-3 border rounded whitespace-pre-wrap">{log}</pre>
    </section>
  );
}
