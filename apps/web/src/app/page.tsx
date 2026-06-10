export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center"
      style={{ backgroundColor: '#FFF4EF' }}>
      <div className="text-center">
        <h1 className="text-5xl font-bold" style={{ color: '#FF6B35' }}>
          PideFacil
        </h1>
        <p className="mt-3 text-lg" style={{ color: '#1A1A2E' }}>
          Pide tu comida favorita en segundos
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Escanea el QR de tu restaurante para comenzar
        </p>
      </div>
    </main>
  );
}
