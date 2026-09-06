import type { Rates } from '../data/pricing';
import { parseScenario, type Scenario } from '../data/scenarios';
import { calculate, validateGates } from '../geometry/materialCalculator';
export function download(text: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportBoq(result: ReturnType<typeof calculate>) {
  const quote = (v: unknown) => '"' + String(v).replaceAll('"', '""') + '"';
  const rows = [
    ['Side', 'Item', 'Quantity', 'Unit', 'Rate INR', 'Amount INR'],
    ...result.rows.map((r) => [
      r.side,
      r.item,
      r.quantity.toFixed(3),
      r.unit,
      r.rate,
      r.amount.toFixed(2),
    ]),
    ['', 'Subtotal', '', '', '', result.subtotal.toFixed(2)],
    ['', 'GST component', '', '', '', result.tax.toFixed(2)],
    ['', 'Total', '', '', '', result.total.toFixed(2)],
  ];
  download(
    '\ufeff' + rows.map((r) => r.map(quote).join(',')).join('\r\n'),
    'ram-farm-boq.csv',
    'text/csv;charset=utf-8',
  );
}
export async function svgPng(id: string, name: string) {
  const svg = document.querySelector<SVGSVGElement>('#' + id);
  if (!svg) throw Error('Open the requested drawing before exporting.');
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sourceNodes = [svg, ...svg.querySelectorAll('*')],
    cloneNodes = [clone, ...clone.querySelectorAll('*')];
  sourceNodes.forEach((node, i) => {
    const style = getComputedStyle(node);
    for (const key of [
      'font-family',
      'font-size',
      'font-weight',
      'letter-spacing',
      'fill',
      'stroke',
      'stroke-width',
    ]) {
      const value = style.getPropertyValue(key);
      if (value) cloneNodes[i].setAttribute(key, value);
    }
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const box = (svg as SVGSVGElement).viewBox.baseVal,
    w = Math.min(10000, box.width || svg.clientWidth),
    h = box.height || svg.clientHeight;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const image = new Image();
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
  );
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w * 1.5;
  canvas.height = h * 1.5;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = name;
  a.click();
}
export function readConfig(text: string): Scenario {
  if (text.length > 5000000) throw Error('File exceeds the 5 MB limit.');
  const data = JSON.parse(text),
    s = parseScenario(data.scenario || data);
  validateGates(s);
  return s;
}
export const shareUrl = (s: Scenario, rates?: Rates) => {
  const copy = structuredClone(s);
  for (const item of Object.values(copy.inspections)) item.photo = '';
  return (
    location.href.split('#')[0] +
    '#plan=' +
    btoa(unescape(encodeURIComponent(JSON.stringify({ scenario: copy, rates }))))
  );
};
export function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (quoted) throw Error('Unclosed CSV quote.');
  return rows;
}
