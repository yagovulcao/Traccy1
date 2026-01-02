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
      // 1) signed upload
      setLog("Gerando signed upload URL…");
      const signed = await fetch("/api/imports/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, fileName: file.name }),
      }).then((r) => r.json());

      if (signed.error) throw new Error(signed.error);

      // 2) upload to signed url
      setLog("Enviando arquivo para Storage…");
      const upRes = await fetch(signed.signed_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "text/csv",
        },
        body: file,
      });

      if (!upRes.ok) {
        const txt = await upRes.text().catch(() => "");
        throw new Error(`Upload failed: ${upRes.status} ${txt}`);
      }

      // 3) create import row
      setLog("Registrando import no banco…");
      const created = await fetch("/api/imports/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          file_name: file.name,
          storage_path: signed.storage_path,
        }),
      }).then((r) => r.json());

      if (created.error) throw new Error(created.error);

      // 4) process latest
      setLog("Processando latest…");
      const processed = await fetch(`/api/process/latest?type=${type}`, {
        method: "POST",
      }).then((r) => r.json());

      if (processed.error) throw new Error(processed.error);

      setLog(
        `OK ✅ import_id=${processed.import_id} snapshot_id=${processed.snapshot_id} rows=${processed.rows} diff_events=${processed.diff_events}`
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
