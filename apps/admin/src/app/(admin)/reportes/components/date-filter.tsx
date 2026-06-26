'use client';

export type Preset = 'today' | '7d' | '30d' | 'custom';

interface DateFilterProps {
  preset: Preset;
  customStart: string;
  customEnd: string;
  onPresetChange: (preset: Preset) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: 'Rango', value: 'custom' },
];

export function DateFilter({
  preset, customStart, customEnd,
  onPresetChange, onCustomStartChange, onCustomEndChange,
}: DateFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onPresetChange(p.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            preset === p.value
              ? 'bg-brand-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <>
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-brand-500"
            />
            <span className="text-gray-400 text-sm">–</span>
            <input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          {(!customStart || !customEnd) && (
            <span className="text-xs text-gray-400 ml-1">Selecciona ambas fechas</span>
          )}
        </>
      )}
    </div>
  );
}
