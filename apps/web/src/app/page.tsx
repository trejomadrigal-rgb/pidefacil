import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center px-6">
      <div className="text-center text-white">
        <div className="text-7xl mb-6">🍽️</div>
        <h1 className="text-4xl font-black mb-3">PideFacil</h1>
        <p className="text-lg text-gray-300 mb-2">
          Recibe prepedidos de tus clientes por QR
        </p>
        <p className="text-sm text-gray-400 mb-10">
          Escanea el QR de tu negocio favorito para ordenar
        </p>
        <div className="inline-block bg-brand-500 text-white rounded-2xl px-8 py-4 font-bold text-base">
          pidefacil.mx
        </div>
      </div>
    </div>
  );
}
