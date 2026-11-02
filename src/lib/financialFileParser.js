import * as XLSX from 'xlsx';

const MAX_ROWS = 5000;
const MAX_PDF_PAGES = 80;
const MAX_OCR_PAGES = 12;

const normalize = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function makeColumns(headerRow = []) {
  const seen = new Map();
  return headerRow.map((value, index) => {
    let label = String(value ?? '').trim() || 'Columna ' + (index + 1);
    const count = seen.get(label) || 0;
    seen.set(label, count + 1);
    if (count) label += ' (' + (count + 1) + ')';
    return label.slice(0, 160);
  });
}

function detectHeaderRow(rows = []) {
  const hints = [
    'fecha','date','dia','periodo','descripcion','detalle','concepto','movimiento',
    'monto','valor','importe','total','ingreso','egreso','gasto','pago','venta',
    'categoria','rubro','cliente','proveedor','producto','articulo','precio','costo',
    'cantidad','unidades','trabajador','empleado','salario','sueldo'
  ];
  let best = { index: 0, score: 0 };
  rows.slice(0, 30).forEach((row, index) => {
    const values = row.map(normalize);
    const score = hints.reduce((sum, hint) => sum + (values.some(v => v === hint || v.includes(hint)) ? 1 : 0), 0);
    if (score > best.score) best = { index, score };
  });
  return best.score >= 2 ? best.index : 0;
}

function parseMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  const accountingNegative = /^\(.*\)$/.test(raw);
  let s = raw.replace(/[^\d,.\-]/g, '');
  if (!s) return NaN;
  const explicitNegative = /^-/.test(s);
  const negative = accountingNegative || explicitNegative;
  s = s.replace(/-/g, '');
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const pos = Math.max(comma, dot);
    const decimals = s.length - pos - 1;
    if (decimals === 1 || decimals === 2) {
      const whole = s.slice(0, pos).replace(/[.,]/g, '');
      const fraction = s.slice(pos + 1);
      const n = Number(whole + '.' + fraction);
      return negative ? -n : n;
    }
    s = s.replace(/[.,]/g, '');
  } else if (comma >= 0) {
    const decimals = s.length - comma - 1;
    s = decimals === 1 || decimals === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return negative ? -n : n;
}

function statementLinesToRows(text) {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map(x => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_ROWS);

  const headerIndex = lines.findIndex(line => {
    const n = normalize(line);
    return /(fecha|date)/.test(n) && /(monto|valor|importe|total|saldo|debito|credito|ingreso|egreso)/.test(n);
  });

  const rows = [];
  if (headerIndex >= 0) {
    const rawHeader = lines[headerIndex];
    const header = rawHeader.split(/\s{2,}|\t+/).map(x => x.trim()).filter(Boolean);
    if (header.length >= 2) {
      for (const line of lines.slice(headerIndex + 1)) {
        const parts = line.split(/\s{2,}|\t+/).map(x => x.trim()).filter(Boolean);
        if (parts.length >= 2) rows.push(parts);
      }
      if (rows.length) return { header: makeColumns(header), rows, mode: 'table' };
    }
  }

  const output = [['Fecha', 'Descripción', 'Monto']];
  const dateRegex = /^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/;
  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    const numbers = [...line.matchAll(/(?:\$|COP|USD)?\s*-?\d[\d.,]*/gi)];
    const last = numbers.length ? numbers[numbers.length - 1] : null;
    const amount = last ? parseMoney(last[0]) : NaN;
    const description = dateMatch
      ? line.slice(dateMatch[0].length).trim().replace(/\s*(-?\d[\d.,]*)\s*$/, '').trim()
      : line.replace(/\s*(-?\d[\d.,]*)\s*$/, '').trim();
    if (dateMatch && Number.isFinite(amount)) {
      output.push([dateMatch[1], description || 'Movimiento histórico', amount]);
    }
  }
  if (output.length > 1) return { header: output[0], rows: output.slice(1), mode: 'statement' };

  return { header: ['Contenido'], rows: lines.map(line => [line]), mode: 'text' };
}

function rowsFromObjects(value) {
  const items = Array.isArray(value) ? value : (
    value && typeof value === 'object'
      ? (Array.isArray(value.data) ? value.data : Object.values(value))
      : []
  );
  const objects = items.filter(x => x && typeof x === 'object' && !Array.isArray(x));
  if (!objects.length) return null;
  const headers = Array.from(new Set(objects.flatMap(x => Object.keys(x)))).slice(0, 100);
  return {
    header: makeColumns(headers),
    rows: objects.slice(0, MAX_ROWS).map(obj => headers.map(h => obj[h] ?? ''))
  };
}

function htmlToSheets(html, sourceName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const sheets = [];
  doc.querySelectorAll('table').forEach((table, i) => {
    const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
      Array.from(tr.querySelectorAll('th,td')).map(td => td.textContent?.replace(/\s+/g, ' ').trim() || '')
    ).filter(row => row.some(Boolean));
    if (rows.length) sheets.push({ name: sourceName + ' tabla ' + (i + 1), rows });
  });
  if (!sheets.length) {
    const text = doc.body?.innerText || doc.documentElement?.textContent || '';
    const parsed = statementLinesToRows(text);
    sheets.push({ name: sourceName, rows: [parsed.header, ...parsed.rows] });
  }
  return sheets;
}

function xmlToSheets(xml, sourceName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xml || ''), 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('El XML no es válido.');
  const candidates = Array.from(doc.querySelectorAll('Row,row,record,Record,item,Item'));
  const records = candidates.map(node => {
    const children = Array.from(node.children);
    return children.length
      ? Object.fromEntries(children.map((child, i) => [
          child.getAttribute('name') || child.tagName || ('Columna ' + (i + 1)),
          child.textContent?.trim() || ''
        ]))
      : null;
  }).filter(Boolean);
  const objectRows = rowsFromObjects(records);
  if (objectRows) return [{ name: sourceName, rows: [objectRows.header, ...objectRows.rows] }];
  const parsed = statementLinesToRows(doc.documentElement?.textContent || '');
  return [{ name: sourceName, rows: [parsed.header, ...parsed.rows] }];
}

function finalizeSheet(raw, extra = {}) {
  const allRows = (raw.rows || []).map(row => Array.isArray(row) ? row.map(v => v ?? '') : [row]).slice(0, MAX_ROWS);
  const headerIndex = detectHeaderRow(allRows);
  return {
    name: String(raw.name || 'Hoja').slice(0, 120),
    allRows,
    headerIndex,
    columns: makeColumns(allRows[headerIndex] || ['Contenido']),
    structure: {
      formulaCount: Number(extra.formulaCount || 0),
      formulaValueUnavailableCount: Number(extra.formulaValueUnavailableCount || 0),
      formulaSamples: Array.isArray(extra.formulaSamples) ? extra.formulaSamples.slice(0, 20) : [],
      formulaColumns: Array.isArray(extra.formulaColumns) ? extra.formulaColumns.slice(0, 20) : [],
      hidden: Boolean(extra.hidden),
      hasVba: Boolean(extra.hasVba),
      sourceType: extra.sourceType || 'document',
      pageNumber: extra.pageNumber || null,
      ocrUsed: Boolean(extra.ocrUsed),
      textSample: String(extra.textSample || '').slice(0, 7000)
    }
  };
}

function parseWorkbook(buffer, fileName) {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const input = isCsv ? new TextDecoder('utf-8', { fatal: true }).decode(buffer) : buffer;
  const workbook = XLSX.read(input, { type: isCsv ? 'string' : 'array', raw: isCsv, cellDates: true, dense: true, cellNF: true, bookVBA: true });
  const workbookSheets = workbook.Workbook?.Sheets || [];
  return workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    const denseData = sheet?.['!data'] || (Array.isArray(sheet) ? sheet : null);
    const cellAt = (row, column) => (denseData?.[row]?.[column] || sheet[XLSX.utils.encode_cell({ r: row, c: column })] || null);
    let formulaCount = 0;
    let formulaValueUnavailableCount = 0;
    const formulaSamples = [];
    const formulaColumnIndexes = new Set();
    let rangeStartColumn = 0;
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref']);
      rangeStartColumn = range.s.c;
      for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 500); r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = cellAt(r, c);
          if (!cell?.f) continue;
          formulaCount++;
          formulaColumnIndexes.add(c);
          if (cell.v === undefined || cell.v === null) formulaValueUnavailableCount++;
          if (formulaSamples.length < 20) {
            formulaSamples.push({
              cell: XLSX.utils.encode_cell({ r, c }),
              formula: String(cell.f).slice(0, 240),
              calculatedValue: cell.v ?? null,
              formattedValue: String(cell.w || '').slice(0, 120),
              numberFormat: cell.z || null,
              valueAvailable: cell.v !== undefined && cell.v !== null
            });
          }
        }
      }
    }
    const meta = workbookSheets.find(x => x.name === sheetName);
    const headerRow = allRows[detectHeaderRow(allRows)] || [];
    return finalizeSheet(
      { name: sheetName, rows: allRows },
      {
        sourceType: fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'spreadsheet',
        formulaCount,
        formulaValueUnavailableCount,
        formulaSamples,
        formulaColumns: Array.from(formulaColumnIndexes).map(i => headerRow[i - rangeStartColumn] || 'Columna ' + (i - rangeStartColumn + 1)),
        hidden: Number(meta?.Hidden || 0) > 0,
        hasVba: Boolean(workbook.vbaraw),
        textSample: JSON.stringify(allRows.slice(0, 12)).slice(0, 7000)
      }
    );
  });
}

async function parsePdf(file) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data, disableWorker: true }).promise;
  const sheets = [];
  const ocrTasks = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_PDF_PAGES); pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = new Map();
    for (const item of content.items || []) {
      const str = String(item.str || '').trim();
      if (!str) continue;
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      const key = String(Math.round(y / 3) * 3);
      const current = lines.get(key) || [];
      current.push({ x, y, str });
      lines.set(key, current);
    }
    const text = Array.from(lines.entries())
      .sort((a,b) => Number(b[0]) - Number(a[0]))
      .map(([, items]) => items.sort((a,b) => a.x - b.x).map(x => x.str).join(' '))
      .join('\n')
      .trim();
    if (text.length >= 30) {
      const parsed = statementLinesToRows(text);
      sheets.push(finalizeSheet(
        { name: 'PDF página ' + pageNumber, rows: [parsed.header, ...parsed.rows] },
        { sourceType: 'pdf', pageNumber, textSample: text }
      ));
    } else if (ocrTasks.length < MAX_OCR_PAGES) {
      ocrTasks.push({ page, pageNumber });
    }
  }

  if (ocrTasks.length) {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('spa');
    try {
      for (const task of ocrTasks) {
        const viewport = task.page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await task.page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) continue;
        const result = await worker.recognize(blob);
        const parsed = statementLinesToRows(result.data.text);
        sheets.push(finalizeSheet(
          { name: 'PDF página ' + task.pageNumber + ' (OCR)', rows: [parsed.header, ...parsed.rows] },
          { sourceType: 'pdf-ocr', pageNumber: task.pageNumber, ocrUsed: true, textSample: result.data.text }
        ));
      }
    } finally {
      await worker.terminate();
    }
  }
  if (!sheets.length) throw new Error('No encontré texto o tablas legibles en el PDF.');
  return sheets;
}

async function parseDocx(file) {
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();
  const html = (await mammoth.convertToHtml({ arrayBuffer: buffer })).value;
  return htmlToSheets(html, file.name.replace(/\.[^.]+$/, ''));
}

async function parseImage(file) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa');
  try {
    const result = await worker.recognize(file);
    const parsed = statementLinesToRows(result.data.text);
    return [{
      name: 'Imagen OCR',
      rows: [parsed.header, ...parsed.rows],
      ocrUsed: true,
      textSample: result.data.text
    }];
  } finally {
    await worker.terminate();
  }
}

export async function parseFinancialFile(file) {
  if (!file) throw new Error('No se seleccionó ningún archivo.');
  const ext = '.' + String(file.name || '').split('.').pop().toLowerCase();
  if (file.size > 25 * 1024 * 1024) throw new Error('El archivo supera 25 MB. Divide el histórico para poder analizarlo con seguridad.');

  const sourceName = String(file.name || 'Archivo').replace(/\.[^.]+$/, '');
  if (['.xlsx','.xls','.xlsb','.xlsm','.xltx','.xltm','.ods','.csv'].includes(ext)) {
    return { sheets: parseWorkbook(await file.arrayBuffer(), file.name), sourceType: ext === '.csv' ? 'csv' : 'spreadsheet', warning: '' };
  }
  if (ext === '.pdf') {
    const sheets = await parsePdf(file);
    return { sheets, sourceType: 'pdf', warning: sheets.some(s => s.structure?.ocrUsed) ? 'Algunas páginas fueron leídas mediante OCR porque no tenían texto digital.' : '' };
  }
  if (ext === '.docx') {
    const raw = await parseDocx(file);
    return { sheets: raw.map(x => finalizeSheet(x, { sourceType: 'docx', textSample: JSON.stringify(x.rows).slice(0, 7000) })), sourceType: 'docx', warning: 'El contenido de Word se convirtió a tablas y texto para el análisis financiero.' };
  }
  if (ext === '.json') {
    const json = JSON.parse(await file.text());
    const rows = rowsFromObjects(json);
    if (!rows) throw new Error('El JSON no contiene una lista de datos que Afluva pueda interpretar.');
    return { sheets: [finalizeSheet({ name: sourceName, rows: [rows.header, ...rows.rows] }, { sourceType: 'json', textSample: JSON.stringify(json).slice(0, 7000) })], sourceType: 'json', warning: '' };
  }
  if (['.txt','.tsv','.tab','.log'].includes(ext)) {
    const parsed = statementLinesToRows(await file.text());
    return { sheets: [finalizeSheet({ name: sourceName, rows: [parsed.header, ...parsed.rows] }, { sourceType: 'text', textSample: parsed.rows.slice(0,20).join(' ') })], sourceType: 'text', warning: '' };
  }
  if (['.html','.htm'].includes(ext)) {
    return { sheets: htmlToSheets(await file.text(), sourceName).map(x => finalizeSheet(x, { sourceType: 'html', textSample: JSON.stringify(x.rows).slice(0,7000) })), sourceType: 'html', warning: '' };
  }
  if (ext === '.xml') {
    return { sheets: xmlToSheets(await file.text(), sourceName).map(x => finalizeSheet(x, { sourceType: 'xml', textSample: JSON.stringify(x.rows).slice(0,7000) })), sourceType: 'xml', warning: '' };
  }
  if (['.png','.jpg','.jpeg','.webp','.bmp','.gif'].includes(ext)) {
    const parsed = await parseImage(file);
    return { sheets: parsed.map(x => finalizeSheet(x, { sourceType: 'image-ocr', ocrUsed: true, textSample: x.textSample || '' })), sourceType: 'image', warning: 'La imagen fue leída con OCR para detectar datos financieros.' };
  }
  if (ext === '.doc') {
    throw new Error('Los documentos .doc antiguos no se pueden interpretar de forma fiable en el navegador. Guárdalo como .docx y Afluva conservará el contenido para el análisis.');
  }
  throw new Error('Formato no compatible todavía. Afluva acepta Excel, CSV, PDF, Word (.docx), JSON, XML, HTML, texto e imágenes financieras.');
}
export function describeSupportedFinancialFileTypes() {
  return 'Excel (XLSX/XLS/XLSB/XLSM/ODS), CSV, PDF, Word DOCX, JSON, XML, HTML, TXT/TSV y PNG/JPG/JPEG/WEBP/BMP/GIF.';
}
