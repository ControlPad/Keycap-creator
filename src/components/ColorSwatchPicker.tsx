export interface ColorSwatchOption {
  id: string;
  name: string;
  hex: string;
  isPremium?: boolean;
}

interface ColorSwatchPickerProps {
  label: string;
  options: ColorSwatchOption[];
  selectedId: string;
  onChange: (option: ColorSwatchOption) => void;
  selectedLabel?: string;
}

export default function ColorSwatchPicker({
  label,
  options,
  selectedId,
  onChange,
  selectedLabel,
}: ColorSwatchPickerProps) {
  const premiumOptions = options.filter((o) => o.isPremium);
  const regularOptions = options.filter((o) => !o.isPremium);

  const swatch = (option: ColorSwatchOption) => (
    <button
      key={option.id}
      type="button"
      onClick={() => onChange(option)}
      className={`h-8 w-8 rounded-full border-2 transition-all ${
        selectedId === option.id
          ? 'border-primary-600 ring-2 ring-primary-300 dark:ring-primary-700'
          : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
      }`}
      style={
        option.name === 'Custom'
          ? { background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }
          : { backgroundColor: option.hex }
      }
      title={option.name}
    />
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {selectedLabel && (
          <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">: {selectedLabel}</span>
        )}
      </h3>

      {premiumOptions.length > 0 && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bessere Qualität</p>
          <div className="flex flex-wrap gap-2 mb-3">{premiumOptions.map(swatch)}</div>
        </>
      )}

      {premiumOptions.length > 0 && regularOptions.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Normale Qualität</p>
      )}
      <div className="flex flex-wrap gap-2">{regularOptions.map(swatch)}</div>
    </div>
  );
}
