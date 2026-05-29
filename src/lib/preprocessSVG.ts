// Propagate stroke/fill presentation attributes from the <svg> root onto child
// shape elements so three's SVGLoader picks them up (it doesn't inherit them).
// Shared by both the live 3D viewer and the 3MF exporter so the export matches
// exactly what's shown on screen.
export function preprocessSVG(svgString: string): string {
  const svgTagMatch = svgString.match(/<svg[^>]*>/);
  if (!svgTagMatch) return svgString;
  const svgTag = svgTagMatch[0];

  const attrNames = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit'];
  const inherited: Record<string, string> = {};
  for (const attr of attrNames) {
    const match = svgTag.match(new RegExp(`${attr}="([^"]*)"`));
    if (match) inherited[attr] = match[1] === 'currentColor' ? '#000000' : match[1];
  }

  if (Object.keys(inherited).length === 0) return svgString;

  return svgString.replace(
    /<(path|circle|rect|line|polyline|polygon|ellipse)(\s[^>]*?)(\/?>)/g,
    (_match, tag: string, attrs: string, close: string) => {
      let extra = '';
      for (const [attr, val] of Object.entries(inherited)) {
        if (!attrs.includes(`${attr}="`)) {
          extra += ` ${attr}="${val}"`;
        }
      }
      return `<${tag}${attrs}${extra}${close}`;
    },
  );
}
