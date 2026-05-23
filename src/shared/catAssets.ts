const catIdleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
  <path fill="#2f2924" d="M18 56h6v12h-6zM30 58h6v12h-6zM58 58h6v12h-6zM72 56h6v12h-6zM10 44h8v8h-8zM4 38h8v8H4z"/>
  <path fill="#4b3b31" d="M18 28h60v34H18z"/>
  <path fill="#6f5b49" d="M24 34h42v20H24z"/>
  <path fill="#4b3b31" d="M22 18h12v14H22zM62 18h12v14H62z"/>
  <path fill="#2f2924" d="M20 16h6v8h-6zM30 18h6v8h-6zM60 18h6v8h-6zM72 16h6v8h-6z"/>
  <path fill="#211c18" d="M34 42h6v6h-6zM58 42h6v6h-6z"/>
  <path fill="#211c18" d="M45 52h6v4h-6zM52 52h4v4h-4z"/>
  <path fill="#d8c1a6" d="M20 50h18v8H20z"/>
  <path fill="#6f5b49" d="M8 50h12v8H8z"/>
</svg>`;

const catAttackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
  <path fill="#2f2924" d="M20 58h6v12h-6zM34 58h6v12h-6zM62 58h6v12h-6zM76 56h6v12h-6zM8 42h10v8H8zM2 34h8v10H2z"/>
  <path fill="#4b3b31" d="M18 28h60v34H18z"/>
  <path fill="#7a6450" d="M24 34h40v20H24z"/>
  <path fill="#4b3b31" d="M22 16h12v16H22zM62 16h12v16H62z"/>
  <path fill="#2f2924" d="M20 14h6v8h-6zM30 16h6v8h-6zM60 16h6v8h-6zM72 14h6v8h-6z"/>
  <path fill="#211c18" d="M34 42h6v6h-6zM58 42h6v6h-6z"/>
  <path fill="#211c18" d="M42 52h18v4H42z"/>
  <path fill="#4b3b31" d="M72 34h16v8H72zM84 28h8v8h-8z"/>
  <path fill="#d8c1a6" d="M20 50h20v8H20z"/>
</svg>`;

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

export const fallbackCatAssets = {
  idle: svgDataUrl(catIdleSvg),
  attack: svgDataUrl(catAttackSvg)
};
