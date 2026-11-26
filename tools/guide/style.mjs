// The house layout of the stakeholder guides and the UAT report, copied from the guide template the client accepted
// (DOP "Receiving Officer Guide"): A4, Arial; cover with a blue kicker, large title, grey subtitle and a label/value block;
// "Document control" table; blue numbered headings; screenshots with a centred italic caption and orange numbered steps under
// them; orange tip boxes; blue-headed tables; grey running header and "Client · Trail Analytics · Page N" footer.
import fs from 'node:fs'
import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx'

export const C = {
  blue: '2563EB',
  navy: '1E3A8A',
  text: '222222',
  grey: '5F6368',
  light: 'EEF4FF',
  rule: 'C9D8F5',
  orange: 'E8731C',
  orangeBg: 'FDF0E4',
  green: '1E8E3E',
  red: 'C5221F',
  amber: 'B06000',
}
const FONT = 'Arial'
/** Every run names its font: some renderers (Quick Look, older Word viewers) ignore the document default. */
const TR = (o) => new TextRun(typeof o === 'string' ? { text: o, font: FONT } : { font: FONT, ...o })
export const PAGE = { width: 11906, height: 16838, margin: 1134 } // A4 in twips, 2 cm margins
export const CONTENT_PX = 642 // usable width in docx pixels (96 dpi) for 17 cm

export const styles = {
  default: { document: { run: { font: FONT, size: 21, color: C.text }, paragraph: { spacing: { after: 120, line: 276 } } } },
  paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { font: FONT, size: 32, bold: true, color: C.blue }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { font: FONT, size: 25, bold: true, color: C.navy }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
    { id: 'Caption', name: 'Caption', basedOn: 'Normal', next: 'Normal',
      run: { font: FONT, size: 19, italics: true, color: '444444' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 80, after: 160 } } },
  ],
}

export const p = (text, o = {}) => new Paragraph({ children: runs(text, o), spacing: o.spacing, alignment: o.align, keepNext: o.keepNext })
export const h1 = (text) => new Paragraph({ style: 'Heading1', children: [TR({ text, font: FONT })] })
export const h2 = (text) => new Paragraph({ style: 'Heading2', children: [TR({ text, font: FONT })] })
export const pageBreak = () => new Paragraph({ children: [new PageBreak()] })

/** Text with **bold** spans. */
export function runs(text, o = {}) {
  const out = []
  String(text ?? '').split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return
    const bold = part.startsWith('**') && part.endsWith('**')
    out.push(TR({ text: bold ? part.slice(2, -2) : part, bold: bold || o.bold, color: o.color, size: o.size, italics: o.italics, font: FONT }))
  })
  return out
}

export function cover({ kicker, title, subtitle, purpose, meta }) {
  const rows = meta.map(([k, v]) =>
    new TableRow({ children: [
      cell([new Paragraph({ children: [TR({ text: k, bold: true, size: 19 })], spacing: { after: 20 } })], { width: 2300, borders: false }),
      cell([new Paragraph({ children: [TR({ text: v, size: 19 })], spacing: { after: 20 } })], { width: 7300, borders: false }),
    ] }))
  return [
    new Paragraph({ spacing: { before: 600, after: 120 }, children: [TR({ text: kicker, bold: true, color: C.blue, size: 22 })] }),
    new Paragraph({ spacing: { after: 0 }, children: [TR({ text: title, bold: true, size: 64 })] }),
    new Paragraph({ spacing: { after: 480 }, children: [TR({ text: subtitle, size: 40, color: C.grey })] }),
    new Paragraph({ spacing: { after: 480 }, children: [TR({ text: purpose, size: 24, color: C.grey })] }),
    new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: [2300, 7300], borders: none(), rows }),
    pageBreak(),
  ]
}

const none = () => ({ top: nb(), bottom: nb(), left: nb(), right: nb(), insideHorizontal: nb(), insideVertical: nb() })
const nb = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' })
const line = (color = C.rule, size = 4) => ({ style: BorderStyle.SINGLE, size, color })

function cell(children, { width, fill, borders = true, margins } = {}) {
  return new TableCell({
    children,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    borders: borders ? { top: line(), bottom: line(), left: line(), right: line() } : { top: nb(), bottom: nb(), left: nb(), right: nb() },
    margins: margins ?? { top: 50, bottom: 50, left: 90, right: 90 },
  })
}

/** A table in the template style: blue header row with white bold text, pale blue body. `widths` in twips (sum about 9600). */
export function table(head, rows, widths) {
  const n = head.length
  const w = widths ?? Array(n).fill(Math.floor(9600 / n))
  const cellText = (t, o = {}) => {
    const parts = String(t ?? '').split('\n')
    return parts.map((line) => new Paragraph({ spacing: { after: 20, line: 250 }, children: runs(line, { size: 18, ...o }) }))
  }
  return new Table({
    width: { size: w.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell(cellText(h, { bold: true, color: 'FFFFFF' }), { width: w[i], fill: C.blue })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => {
        const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? v : { text: v }
        return cell(cellText(o.text, { color: o.color, bold: o.bold }), { width: w[i], fill: o.fill ?? C.light })
      }) })),
    ],
  })
}

/** The orange "Tip" box. */
export function tip(text, label = 'Tip') {
  return new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [9600],
    rows: [new TableRow({ children: [new TableCell({
      children: [new Paragraph({ spacing: { after: 0, line: 264 }, children: [TR({ text: `${label}  `, bold: true, color: C.orange }), ...runs(text)] })],
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.orangeBg },
      borders: { left: { style: BorderStyle.SINGLE, size: 36, color: C.orange }, top: nb(), bottom: nb(), right: nb() },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
    })] })],
  })
}

/** Size of a PNG from its header. */
export function pngSize(file) {
  const b = fs.readFileSync(file)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), data: b }
}

/** A screenshot, its caption and the numbered steps under it (orange bold numbers, as in the template). */
export function figure(file, number, caption, marks = [], steps = [], maxHeight = 560) {
  const { width, height, data } = pngSize(file)
  let w = CONTENT_PX
  let h = Math.round((height * w) / width)
  if (h > maxHeight) { h = maxHeight; w = Math.round((width * h) / height) }
  const out = [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 0 },
      children: [new ImageRun({ type: 'png', data, transformation: { width: w, height: h },
        outline: { type: 'solidFill', solidFillType: 'rgb', value: 'D0D5DD', width: 6350 } })] }),
    new Paragraph({ style: 'Caption', keepNext: marks.length + steps.length > 0, children: [TR({ text: `Figure ${number}. ${caption}`, italics: true, size: 19, color: '444444' })] }),
  ]
  const all = [...marks, ...steps]
  all.forEach((t, i) => out.push(numbered(i + 1, t, i < all.length - 1)))
  return out
}

export function numbered(n, text, keepNext = false) {
  return new Paragraph({
    keepNext,
    spacing: { after: 60 },
    tabStops: [{ type: TabStopType.LEFT, position: 420 }],
    indent: { left: 420, hanging: 420 },
    children: [TR({ text: String(n), bold: true, color: C.orange }), TR({ text: '\t' }), ...runs(text)],
  })
}

/** "1. Click ..." steps with bold black numbers (the template's numbered procedure). */
export function steps(list) {
  return list.map((t, i) => new Paragraph({
    spacing: { after: 70 },
    tabStops: [{ type: TabStopType.LEFT, position: 420 }],
    indent: { left: 420, hanging: 420 },
    children: [TR({ text: `${i + 1}.`, bold: true }), TR({ text: '\t' }), ...runs(t)],
  }))
}

export function bullets(list) {
  return list.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: runs(t) }))
}

export function headerFooter(headerText, footerText) {
  return {
    headers: {
      default: new Header({ children: [new Paragraph({ children: [TR({ text: headerText, size: 17, color: C.grey })] })] }),
      first: new Header({ children: [new Paragraph('')] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [TR({ text: `${footerText} · Page `, size: 17, color: C.grey }), TR({ children: [PageNumber.CURRENT], size: 17, color: C.grey })] })] }),
      first: new Footer({ children: [new Paragraph('')] }),
    },
  }
}

export const pageProps = {
  titlePage: true,
  page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin, header: 560, footer: 560 } },
}

export function docControl(rows) {
  return [h1('Document control'), table(['Version', 'Date', 'Change', 'By'], rows, [1500, 1700, 4300, 2100])]
}

export function contents(titles) {
  return [h2('Contents'), ...titles.map((t, i) => new Paragraph({ spacing: { after: 50 }, children: [TR({ text: `${i + 1}.  ${t}` })] }))]
}
