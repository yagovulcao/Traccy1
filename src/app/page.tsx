import UploadClient from "./upload/UploadClient";

export default function HomePage() {
  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Traccy</h1>
        <p className="text-sm opacity-80">
          Upload → cria import → processa latest → gera snapshot + alerts → dashboard
        </p>
      </header>

      <UploadClient />
    </main>
  );
}
