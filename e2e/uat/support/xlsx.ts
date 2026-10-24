import { crc32, inflateRawSync } from 'node:zlib'

/**
 * A small .xlsx writer and reader, so the cases can upload generated workbooks and look inside the ones they download without
 * adding a spreadsheet library. Cells are text (inline strings); that is how the app reads uploads (everything as text).
 */

const xmlEscape = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)

function column(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(content)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, data)
    const head = Buffer.alloc(46)
    head.writeUInt32LE(0x02014b50, 0)
    head.writeUInt16LE(20, 4)
    head.writeUInt16LE(20, 6)
    head.writeUInt32LE(crc, 16)
    head.writeUInt32LE(data.length, 20)
    head.writeUInt32LE(data.length, 24)
    head.writeUInt16LE(nameBytes.length, 28)
    head.writeUInt32LE(offset, 42)
    central.push(head, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuffer, end])
}

/** A workbook with one sheet; `rows[0]` is the header row. */
export function buildXlsx(rows: string[][], sheetName = 'Sheet1'): Buffer {
  const sheetRows = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map((cell, c) =>
            cell === ''
              ? ''
              : `<c r="${column(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`,
          )
          .join('')}</row>`,
    )
    .join('')
  return zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  })
}

/** The files of a zip (stored or deflated), by name. */
export function unzip(buffer: Buffer): Record<string, Buffer> {
  const out: Record<string, Buffer> = {}
  let eocd = buffer.length - 22
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1
  if (eocd < 0) throw new Error('not a zip file')
  const count = buffer.readUInt16LE(eocd + 10)
  let p = buffer.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(p + 10)
    const size = buffer.readUInt32LE(p + 20)
    const nameLength = buffer.readUInt16LE(p + 28)
    const extraLength = buffer.readUInt16LE(p + 30)
    const commentLength = buffer.readUInt16LE(p + 32)
    const local = buffer.readUInt32LE(p + 42)
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLength)
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const raw = buffer.subarray(dataStart, dataStart + size)
    out[name] = method === 0 ? Buffer.from(raw) : inflateRawSync(raw)
    p += 46 + nameLength + extraLength + commentLength
  }
  return out
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

/** The first sheet of a workbook as rows of text (shared and inline strings, numbers as written). */
export function readXlsx(buffer: Buffer): string[][] {
  const files = unzip(buffer)
  const shared: string[] = []
  const sst = files['xl/sharedStrings.xml']?.toString('utf8') ?? ''
  for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
  }
  const sheetName = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0]
  const xml = files[sheetName].toString('utf8')
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const cell of rowMatch[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(cell[1])?.[1] ?? 'A'
      const index = [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const type = /t="(\w+)"/.exec(cell[1])?.[1]
      const inner = cell[2] ?? ''
      let value = ''
      if (type === 's') value = shared[Number(/<v>(\d+)<\/v>/.exec(inner)?.[1])] ?? ''
      else if (type === 'inlineStr')
        value = decode([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
      else value = decode(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '')
      row[index] = value
    }
    rows.push(Array.from(row, (v) => v ?? ''))
  }
  return rows
}
