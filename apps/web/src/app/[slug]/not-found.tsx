import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-brand-900 mb-2">
          Negocio no encontrado
        </h1>
        <p className="text-gray-500 mb-6">
          El negocio que buscas no existe o no está disponible.
        </p>
        <Link
          href="/"
          className="inline-block bg-brand-500 text-white px-6 py-3 rounded-xl font-semibold"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
