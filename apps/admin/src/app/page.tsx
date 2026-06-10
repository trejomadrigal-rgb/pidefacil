export default function AdminHome() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder */}
      <aside
        className="w-64 flex flex-col items-center justify-center"
        style={{ backgroundColor: '#1A1A2E' }}
      >
        <h2 className="text-2xl font-bold" style={{ color: '#FF6B35' }}>
          PideFacil
        </h2>
        <p className="mt-1 text-xs" style={{ color: '#9CA3AF' }}>
          Panel Administrativo
        </p>
      </aside>

      {/* Content area */}
      <main
        className="flex-1 flex flex-col items-center justify-center"
        style={{ backgroundColor: '#F5F5F5' }}
      >
        <h1 className="text-3xl font-bold" style={{ color: '#1A1A2E' }}>
          Bienvenido
        </h1>
        <p className="mt-2 text-gray-500">
          Panel en construcción — Fase 1
        </p>
      </main>
    </div>
  );
}
