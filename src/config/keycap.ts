// Static keycap configuration — extracted from the ControlPad backend seeder
// (database/seeders/ControlPadSeeder.php). No server/API required.

export interface ColorOption {
  name: string;
  hex: string;
  badge: string | null;
}

export interface BulkPricingTier {
  min_qty: number;
  price: string;
}

// Shared color palette (Primär- und Sekundärfarbe).
// Sorted: "Bessere Qualität" first, then "Normale Qualität".
export const COLORS: ColorOption[] = [
  { name: 'Orange', hex: '#ff6d00', badge: 'Bessere Qualität' },
  { name: 'Schwarz', hex: '#1a1a1a', badge: 'Bessere Qualität' },
  { name: 'Aschgrau', hex: '#9e9e9e', badge: 'Normale Qualität' },
  { name: 'Elfenbeinweiß', hex: '#fffff0', badge: 'Normale Qualität' },
  { name: 'Grau', hex: '#757575', badge: 'Normale Qualität' },
  { name: 'Jade-Weiß', hex: '#e8f5e9', badge: 'Normale Qualität' },
  { name: 'Kastanienrot', hex: '#6d1b1b', badge: 'Normale Qualität' },
  { name: 'Kohlschwarz', hex: '#212121', badge: 'Normale Qualität' },
  { name: 'Kürbis-Orange', hex: '#e65100', badge: 'Normale Qualität' },
  { name: 'Rot', hex: '#d32f2f', badge: 'Normale Qualität' },
  { name: 'Sonnenblumen-Gelb', hex: '#fdd835', badge: 'Normale Qualität' },
  { name: 'Türkis', hex: '#00bcd4', badge: 'Normale Qualität' },
  { name: 'Custom', hex: '#cccccc', badge: null },
];

// Icon-Set spec group.
export const ICON_VARIANTS = ['outline', 'filled'] as const;

export const BULK_PRICING_TIERS: BulkPricingTier[] = [
  { min_qty: 1, price: '0.50' },
  { min_qty: 6, price: '2.50' },
];

export const PRODUCT_NAME = 'Keycaps';
export const PRODUCT_DESCRIPTION =
  'Individuelle Keycaps für dein Slidr — wähle aus verschiedenen Designs und Farben.';

// Default selections.
export const DEFAULT_BASE_COLOR = '#ff6d00';
export const DEFAULT_SYMBOL_COLOR = '#1a1a1a';

// ----- Static asset URLs (respect Vite base path for GitHub Pages) -----

const BASE = import.meta.env.BASE_URL; // e.g. "/" or "/repo/"

export const STL_URL = `${BASE}keycap.stl`;
export const ICONS_MANIFEST_URL = `${BASE}icons/manifest.json`;

export function iconSvgUrl(name: string): string {
  return `${BASE}icons/${name}.svg`;
}
