import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ICONS_MANIFEST_URL, iconSvgUrl } from '../config/keycap';

interface SymbolBrowserProps {
  selectedIcon: string | null;
  onSelect: (name: string, svgContent: string) => void;
  variants?: readonly string[];
}

const PAGE_SIZE = 120;

const VARIANT_LABELS: Record<string, string> = {
  outline: 'Outline',
  filled: 'Filled',
};

function filterByVariant(icons: string[], variant: string): string[] {
  switch (variant) {
    case 'outline':
      return icons.filter((name) => !name.endsWith('-filled') && !/-f$/.test(name));
    case 'filled':
      return icons.filter((name) => name.endsWith('-filled'));
    default:
      return icons;
  }
}

async function fetchIconSvg(name: string): Promise<string> {
  const res = await fetch(iconSvgUrl(name));
  if (!res.ok) throw new Error(`Icon nicht gefunden: ${name}`);
  return res.text();
}

export default function SymbolBrowser({ selectedIcon, onSelect, variants }: SymbolBrowserProps) {
  const [allIcons, setAllIcons] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [loadedIcons, setLoadedIcons] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(ICONS_MANIFEST_URL)
      .then((res) => res.json() as Promise<string[]>)
      .then((icons) => {
        setAllIcons(icons);
        if (variants && variants.length > 1) {
          setActiveVariant(variants[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [variants]);

  let filtered = search
    ? allIcons.filter((name) => name.includes(search.toLowerCase()))
    : allIcons;

  if (activeVariant) {
    filtered = filterByVariant(filtered, activeVariant);
  }

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, activeVariant]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filtered.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  const handleSelect = useCallback(
    async (name: string) => {
      setSelecting(name);
      try {
        const svgContent = await fetchIconSvg(name);
        onSelect(name, svgContent);
        setUploadedFileName(null);
      } catch {
        // ignore
      } finally {
        setSelecting(null);
      }
    },
    [onSelect],
  );

  const handleSvgUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const svgContent = reader.result as string;
        onSelect('custom-upload', svgContent);
        setUploadedFileName(file.name);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onSelect],
  );

  const visible = filtered.slice(0, visibleCount);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Symbole werden geladen…
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="Symbol suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-primary-200 dark:border-primary-900/40 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 rounded-lg border border-primary-200 dark:border-primary-900/40 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          SVG hochladen
        </button>
        <input ref={fileInputRef} type="file" accept=".svg" onChange={handleSvgUpload} className="hidden" />
      </div>

      {uploadedFileName && selectedIcon === 'custom-upload' && (
        <p className="text-xs text-primary-600 dark:text-primary-400 mb-2 truncate">
          Eigenes Symbol: {uploadedFileName}
        </p>
      )}

      {variants && variants.length > 1 && (
        <div className="flex gap-1 mb-2">
          {variants.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setActiveVariant(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeVariant === v
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {VARIANT_LABELS[v] || v}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto rounded-lg border border-primary-200 dark:border-primary-900/40 bg-white dark:bg-gray-800 p-2">
        <div className="grid grid-cols-6 gap-1">
          {visible.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleSelect(name)}
              disabled={selecting === name}
              className={`h-10 w-10 rounded flex items-center justify-center transition-all ${
                selectedIcon === name
                  ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${selecting === name ? 'opacity-50' : ''}`}
              title={name}
            >
              <div className="relative h-7 w-7">
                {!loadedIcons.has(name) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="h-4 w-4 animate-spin text-gray-300" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </div>
                )}
                <img
                  src={iconSvgUrl(name)}
                  alt={name}
                  className={`h-7 w-7 dark:invert ${!loadedIcons.has(name) ? 'opacity-0' : ''}`}
                  loading="lazy"
                  onLoad={() => setLoadedIcons((prev) => new Set(prev).add(name))}
                />
              </div>
            </button>
          ))}
        </div>
        {visibleCount < filtered.length && (
          <div ref={sentinelRef} className="flex justify-center py-2">
            <span className="text-xs text-gray-400">
              {visible.length} von {filtered.length} geladen…
            </span>
          </div>
        )}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">Keine Symbole gefunden</p>
        )}
      </div>
    </div>
  );
}
