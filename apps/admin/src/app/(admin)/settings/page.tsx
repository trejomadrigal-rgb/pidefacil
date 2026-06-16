import { BusinessForm } from '@/components/settings/business-form';

export default function SettingsPage() {
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="font-jakarta font-bold text-brand-900 text-xl">Configuración</h1>
        <p className="text-sm text-gray-400 mt-1">Gestiona la información de tu negocio</p>
      </div>
      <BusinessForm />
    </div>
  );
}
