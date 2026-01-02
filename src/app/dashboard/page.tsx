import DashboardClient from "./DashboardClient";

export default function DashboardPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const type = (searchParams.type === "FLQA" ? "FLQA" : "FLA") as "FLA" | "FLQA";
  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm opacity-80">Tipo: {type}</p>
        </div>
        <a className="underline text-sm" href="/">
          Voltar
        </a>
      </header>

      <DashboardClient type={type} />
    </main>
  );
}
