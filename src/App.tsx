import { useState, useCallback, useRef, type ChangeEvent } from 'react';
import KeycapViewer from './components/KeycapViewer';
import SymbolBrowser from './components/SymbolBrowser';
import ColorSwatchPicker from './components/ColorSwatchPicker';
import Button from './components/Button';
import { generateKeycap3MF, downloadBlob } from './lib/threemf/generate3mf';
import {
  COLORS,
  ICON_VARIANTS,
  DEFAULT_BASE_COLOR,
  DEFAULT_SYMBOL_COLOR,
  PRODUCT_NAME,
  PRODUCT_DESCRIPTION,
  STL_URL,
  type ColorOption,
} from './config/keycap';

const PREMIUM_BADGE = 'Bessere Qualität';

// Shape of the exported/imported configuration file.
interface KeycapConfigFile {
  version: 1;
  baseColor: string;
  symbolColor: string;
  symbolName: string | null;
  svgContent: string | null;
  scale: number;
  rotation: number;
  depth: number;
  offsetZ: number;
}

function badgeOf(hex: string): string | null {
  return COLORS.find((c) => c.hex === hex)?.badge ?? null;
}

function swatchOptions(): { id: string; name: string; hex: string; isPremium: boolean }[] {
  return COLORS.map((c: ColorOption) => ({
    id: c.hex,
    name: c.name,
    hex: c.hex,
    isPremium: c.badge === PREMIUM_BADGE,
  }));
}

const SLIDERS = [
  { key: 'scale', label: 'Skalierung', min: 0.1, max: 3, step: 0.05 },
  { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 5 },
  { key: 'depth', label: 'Höhe', min: 0, max: 2.0, step: 0.1 },
  { key: 'offsetZ', label: 'Z-Position', min: -2, max: 2, step: 0.05 },
] as const;

export default function App() {
  const [baseColor, setBaseColor] = useState(DEFAULT_BASE_COLOR);
  const [symbolColor, setSymbolColor] = useState(DEFAULT_SYMBOL_COLOR);
  const [selectedSymbolName, setSelectedSymbolName] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [depth, setDepth] = useState(0);
  const [offsetZ, setOffsetZ] = useState(0);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const configInputRef = useRef<HTMLInputElement>(null);

  const handleSymbolSelect = useCallback((name: string, svg: string) => {
    setSelectedSymbolName(name);
    setSvgContent(svg);
  }, []);

  // Export the current configuration as a JSON file (includes the SVG so custom
  // uploads survive a round-trip). Re-importable via handleImportConfig.
  function handleExportConfig() {
    const config: KeycapConfigFile = {
      version: 1,
      baseColor,
      symbolColor,
      symbolName: selectedSymbolName,
      svgContent,
      scale,
      rotation,
      depth,
      offsetZ,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const safeName = (selectedSymbolName ?? 'keycap').replace(/[^a-z0-9-]/gi, '_');
    downloadBlob(blob, `keycap-${safeName}.json`);
  }

  function handleImportConfig(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cfg = JSON.parse(reader.result as string) as Partial<KeycapConfigFile>;
        if (typeof cfg.baseColor === 'string') setBaseColor(cfg.baseColor);
        if (typeof cfg.symbolColor === 'string') setSymbolColor(cfg.symbolColor);
        setSelectedSymbolName(cfg.symbolName ?? null);
        setSvgContent(cfg.svgContent ?? null);
        if (typeof cfg.scale === 'number') setScale(cfg.scale);
        if (typeof cfg.rotation === 'number') setRotation(cfg.rotation);
        if (typeof cfg.depth === 'number') setDepth(cfg.depth);
        if (typeof cfg.offsetZ === 'number') setOffsetZ(cfg.offsetZ);
        setExportError(null);
      } catch {
        setExportError('Konfigurationsdatei konnte nicht gelesen werden.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const sliderState: Record<string, [number, (v: number) => void]> = {
    scale: [scale, setScale],
    rotation: [rotation, setRotation],
    depth: [depth, setDepth],
    offsetZ: [offsetZ, setOffsetZ],
  };

  // Keep base + symbol on the same quality tier (matches original configurator).
  function enforceQuality(changed: 'base' | 'symbol', hex: string) {
    const quality = badgeOf(hex);
    if (changed === 'base') {
      setBaseColor(hex);
      if (badgeOf(symbolColor) !== quality) {
        const match = COLORS.find((c) => c.badge === quality);
        if (match) setSymbolColor(match.hex);
      }
    } else {
      setSymbolColor(hex);
      if (badgeOf(baseColor) !== quality) {
        const match = COLORS.find((c) => c.badge === quality);
        if (match) setBaseColor(match.hex);
      }
    }
  }

  async function handleExport() {
    if (!svgContent) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await generateKeycap3MF({ stlUrl: STL_URL, svg: svgContent, depth, scale, rotation, offsetZ });
      const safeName = (selectedSymbolName ?? 'keycap').replace(/[^a-z0-9-]/gi, '_');
      downloadBlob(blob, `keycap-${safeName}.3mf`);
    } catch (err) {
      setExportError((err as Error).message || 'Export fehlgeschlagen.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-page-bg text-gray-900 dark:bg-page-bg-dark dark:text-gray-100">
      <header className="border-b border-primary-200/60 dark:border-primary-900/40">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-primary-800 dark:text-primary-200">{PRODUCT_NAME} Konfigurator</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{PRODUCT_DESCRIPTION}</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 3D Viewport */}
          <div className="lg:w-2/3 lg:sticky lg:top-6 lg:self-start">
            <KeycapViewer
              stlUrl={STL_URL}
              baseColor={baseColor}
              symbolColor={symbolColor}
              svgContent={svgContent}
              scale={scale}
              rotation={rotation}
              depth={depth}
              offsetZ={offsetZ}
            />
          </div>

          {/* Config Panel */}
          <div className="lg:w-1/3 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Symbol</h3>
              <SymbolBrowser selectedIcon={selectedSymbolName} onSelect={handleSymbolSelect} variants={ICON_VARIANTS} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Einstellungen</h3>
              <div className="space-y-3">
                {SLIDERS.map(({ key, label, min, max, step }) => {
                  const [value, setter] = sliderState[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-28 shrink-0">{label}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={Math.min(max, Math.max(min, value))}
                        onChange={(e) => setter(parseFloat(e.target.value))}
                        className="flex-1 accent-primary-600"
                      />
                      <input
                        type="number"
                        step={step}
                        value={value}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) setter(v);
                        }}
                        className="w-14 rounded border border-primary-200 dark:border-primary-900/40 bg-page-bg dark:bg-page-bg-dark px-1 py-0.5 text-xs text-right text-gray-700 dark:text-gray-300 tabular-nums focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <ColorSwatchPicker
              label="Grundfarbe"
              options={swatchOptions()}
              selectedId={baseColor}
              onChange={(opt) => enforceQuality('base', opt.hex)}
              selectedLabel={COLORS.find((c) => c.hex === baseColor)?.name}
            />

            <ColorSwatchPicker
              label="Symbolfarbe"
              options={swatchOptions()}
              selectedId={symbolColor}
              onChange={(opt) => enforceQuality('symbol', opt.hex)}
              selectedLabel={COLORS.find((c) => c.hex === symbolColor)?.name}
            />

            {/* Save / load the current configuration as a JSON file */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => configInputRef.current?.click()}
              >
                Konfiguration importieren
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleExportConfig}
                disabled={!selectedSymbolName}
              >
                Konfiguration exportieren
              </Button>
            </div>
            <input
              ref={configInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportConfig}
              className="hidden"
            />

            <Button className="w-full" onClick={handleExport} disabled={!selectedSymbolName || !svgContent || exporting}>
              {exporting ? '3MF wird erstellt…' : '.3MF exportieren'}
            </Button>

            {exportError && <p className="text-sm text-red-500">{exportError}</p>}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Die .3mf-Datei wird direkt in deinem Browser erzeugt und heruntergeladen – nichts wird hochgeladen oder
              gespeichert. Sie enthält zwei Bauteile (Korpus + Inlay) für den Mehrfarbdruck, z.&nbsp;B. in Bambu Studio.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
