/**
 * Fills the bundled DTR template (.xlsx) with a month's data and returns the new file bytes.
 * The template's styles, theme, column widths and page setup are kept; data-row styles
 * (thin borders, 0.000, dd-mm-yyyy) are added to its styles.xml once per export.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { buildSheetXml, ReportData, ReportStyles, ReportTotals } from './sheet';

/** Where the template's own styles live (cell → style index), read from the template sheet. */
const TEMPLATE_STYLE_CELLS: Record<string, keyof ReportStyles> = {
  A1: 'title',
  A2: 'subtitle',
  A4: 'heading',
  A7: 'label',
  B7: 'value',
  A10: 'bar',
  A11: 'colHead',
  A12: 'empty',
  A35: 'reconLabel',
  H35: 'reconValue',
  I35: 'omr',
  A38: 'balLabel',
  H38: 'balValue',
  I38: 'balOmr',
};

const FALLBACK: Partial<ReportStyles> = {
  title: 1, subtitle: 2, heading: 3, label: 4, value: 5, bar: 6, colHead: 7, empty: 8,
  reconLabel: 10, reconValue: 11, omr: 12, balLabel: 13, balValue: 14, balOmr: 15,
};

function styleOf(sheetXml: string, ref: string): number | undefined {
  const m = sheetXml.match(new RegExp(`<c r="${ref}"[^>]*?\\ss="(\\d+)"`));
  return m ? Number(m[1]) : undefined;
}

function countOf(xml: string, tag: string): number {
  const m = xml.match(new RegExp(`<${tag} count="(\\d+)"`));
  return m ? Number(m[1]) : 0;
}

/** Append fonts, a date format and the data-row cell formats; return their indexes. */
export function addDataStyles(stylesXml: string): { xml: string; ids: Pick<ReportStyles, 'dCenter' | 'dDate' | 'dText' | 'dAmount' | 'dRemarks' | 'subLabel' | 'subValue'> } {
  let xml = stylesXml;

  // Number formats: 0.000 (reuse if present) and dd-mm-yyyy
  let amountFmt = Number(xml.match(/<numFmt numFmtId="(\d+)" formatCode="0\.000"\/>/)?.[1] ?? 0);
  const fmtIds = [...xml.matchAll(/numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
  let next = Math.max(163, ...fmtIds) + 1;
  const newFmts: string[] = [];
  if (!amountFmt) {
    amountFmt = next++;
    newFmts.push(`<numFmt numFmtId="${amountFmt}" formatCode="0.000"/>`);
  }
  const dateFmt = next++;
  newFmts.push(`<numFmt numFmtId="${dateFmt}" formatCode="dd\\-mm\\-yyyy"/>`);
  if (/<numFmts count="\d+">/.test(xml)) {
    const n = countOf(xml, 'numFmts') + newFmts.length;
    xml = xml.replace(/<numFmts count="\d+">/, `<numFmts count="${n}">`).replace('</numFmts>', `${newFmts.join('')}</numFmts>`);
  } else {
    xml = xml.replace(/<fonts /, `<numFmts count="${newFmts.length}">${newFmts.join('')}</numFmts><fonts `);
  }

  // Fonts: 9.5 regular and 9.5 bold (Calibri, like the template's table text)
  const fontBase = countOf(xml, 'fonts');
  const fonts = ['<font><sz val="9.5"/><name val="Calibri"/><family val="2"/></font>', '<font><b/><sz val="9.5"/><name val="Calibri"/><family val="2"/></font>'];
  xml = xml.replace(/<fonts count="\d+"/, `<fonts count="${fontBase + fonts.length}"`).replace('</fonts>', `${fonts.join('')}</fonts>`);
  const fData = fontBase;
  const fBold = fontBase + 1;

  // Thin border (the template's table border, or a new one)
  let border = 1;
  if (countOf(xml, 'borders') < 2) {
    const n = countOf(xml, 'borders');
    const b = '<border><left style="thin"><color rgb="FFB9B0A0"/></left><right style="thin"><color rgb="FFB9B0A0"/></right><top style="thin"><color rgb="FFB9B0A0"/></top><bottom style="thin"><color rgb="FFB9B0A0"/></bottom><diagonal/></border>';
    xml = xml.replace(/<borders count="\d+"/, `<borders count="${n + 1}"`).replace('</borders>', `${b}</borders>`);
    border = n;
  }
  // Sand fill for sub-total rows (the template's header fill F5F1E4, or none)
  const fills = [...(xml.match(/<fills[\s\S]*?<\/fills>/)?.[0].matchAll(/<fill>[\s\S]*?<\/fill>/g) ?? [])].map((m) => m[0]);
  const sand = Math.max(0, fills.findIndex((f) => f.includes('FFF5F1E4')));

  const xfBase = countOf(xml, 'cellXfs');
  const xf = (numFmt: number, font: number, fill: number, align: string) =>
    `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${align}/></xf>`;
  const xfs = [
    xf(0, fData, 0, 'horizontal="center" vertical="center"'), // dCenter
    xf(dateFmt, fData, 0, 'horizontal="center" vertical="center"'), // dDate
    xf(0, fData, 0, 'horizontal="left" vertical="center" wrapText="1"'), // dText
    xf(amountFmt, fData, 0, 'horizontal="right" vertical="center"'), // dAmount
    xf(0, fData, 0, 'horizontal="left" vertical="center" wrapText="1"'), // dRemarks
    xf(0, fBold, sand, 'horizontal="right" vertical="center"'), // subLabel
    xf(amountFmt, fBold, sand, 'horizontal="right" vertical="center"'), // subValue
  ];
  xml = xml.replace(/<cellXfs count="\d+"/, `<cellXfs count="${xfBase + xfs.length}"`).replace('</cellXfs>', `${xfs.join('')}</cellXfs>`);

  return {
    xml,
    ids: {
      dCenter: xfBase,
      dDate: xfBase + 1,
      dText: xfBase + 2,
      dAmount: xfBase + 3,
      dRemarks: xfBase + 4,
      subLabel: xfBase + 5,
      subValue: xfBase + 6,
    },
  };
}

export function buildReportXlsx(template: Uint8Array, data: ReportData): { bytes: Uint8Array; totals: ReportTotals } {
  const files = unzipSync(template);
  const sheetPath = Object.keys(files).find((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p));
  if (!sheetPath || !files['xl/styles.xml'] || !files['xl/workbook.xml']) throw new Error('The report template is damaged.');

  const templateSheet = strFromU8(files[sheetPath]);
  const base = {} as ReportStyles;
  for (const [ref, key] of Object.entries(TEMPLATE_STYLE_CELLS)) {
    base[key] = styleOf(templateSheet, ref) ?? (FALLBACK[key] as number);
  }
  const { xml: styles, ids } = addDataStyles(strFromU8(files['xl/styles.xml']));
  const { xml: sheet, totals } = buildSheetXml(templateSheet, data, { ...base, ...ids });

  // Excel recalculates every formula when the file is opened.
  let workbook = strFromU8(files['xl/workbook.xml']);
  workbook = /<calcPr[^>]*\/>/.test(workbook)
    ? workbook.replace(/<calcPr([^>]*?)\s*\/>/, (_m, attrs: string) => `<calcPr${attrs.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`)
    : workbook.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');

  const out: Zippable = {};
  for (const [path, content] of Object.entries(files)) {
    if (path === 'xl/calcChain.xml') continue; // stale after rewriting cells
    out[path] = content;
  }
  out[sheetPath] = strToU8(sheet);
  out['xl/styles.xml'] = strToU8(styles);
  out['xl/workbook.xml'] = strToU8(workbook);
  if (files['xl/calcChain.xml']) {
    out['[Content_Types].xml'] = strToU8(strFromU8(files['[Content_Types].xml']).replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
    out['xl/_rels/workbook.xml.rels'] = strToU8(strFromU8(files['xl/_rels/workbook.xml.rels']).replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''));
  }
  return { bytes: zipSync(out, { level: 6 }), totals };
}
