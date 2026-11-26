#!/usr/bin/env node
// Builds one Word guide per stakeholder from tools/guide/content/<role>.mjs and the screenshots in guide-out/<role>/.
//
//   node tools/guide/build-docx.mjs [--out <dir>] [--date "26 November 2026"] [role ...]
//
// Then tools/guide/docx-to-pdf.sh <dir> makes the PDFs with Microsoft Word. A figure named in the content but missing from
// guide-out fails the build (rerun its journey: npx playwright test -c playwright.guide.config.ts e2e/guide/<role>.guide.ts).
import fs from 'node:fs'
import path from 'node:path'
import { Document, Packer } from 'docx'
import * as S from './style.mjs'

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  if (i < 0) return dflt
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const outDir = path.resolve(opt('--out', 'guide-out/docx'))
const date = opt('--date', new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kampala' }).format(new Date()))
const version = opt('--version', '1.0')
const shots = path.resolve(opt('--shots', 'guide-out'))
const here = path.dirname(new URL(import.meta.url).pathname)
const roles = args.length ? args : fs.readdirSync(path.join(here, 'content')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, ''))

fs.mkdirSync(outDir, { recursive: true })
const CLIENT = 'KCB Bank Uganda'

for (const role of roles) {
  const content = (await import(path.join(here, 'content', `${role}.mjs`))).default
  const dir = path.join(shots, content.role)
  let figN = 0
  const missing = []
  const titles = content.sections.map((s) => s.title)
  if (content.emails?.length) titles.push('Emails you will receive')
  if (content.messages?.length || fs.existsSync(path.join(dir, '_messages.json'))) titles.push('Messages and what to do')

  const body = []
  body.push(...S.cover({
    kicker: content.kicker,
    title: content.title,
    subtitle: content.subtitle,
    purpose: content.purpose,
    meta: [
      ['Applies to', content.appliesTo],
      ['Intended for', content.audience ?? ''],
      ['Version', `${version} – for user acceptance testing`],
      ['Date', date],
      ['Prepared by', 'Trail Analytics'],
    ],
  }))
  body.push(...S.docControl([[version, date, 'First issue. Screenshots taken on a test copy of Credit Analyst 3.0 with made-up customers, loans and users.', 'Trail Analytics']]))
  body.push(S.h2('How to read the screenshots'))
  body.push(S.p('Orange outlines and numbered badges show where to click, in order. The tip next to each number says what it does. The same numbered steps are listed under each screenshot.'))
  body.push(...S.contents(titles))

  const renderBlocks = (blocks) => {
    for (const b of blocks) {
      if (b.p) body.push(S.p(b.p))
      else if (b.h2) body.push(S.h2(b.h2))
      else if (b.tip) body.push(S.tip(b.tip), S.p(''))
      else if (b.note) body.push(S.tip(b.note, 'Note'), S.p(''))
      else if (b.steps) body.push(...S.steps(b.steps))
      else if (b.bullets) body.push(...S.bullets(b.bullets))
      else if (b.table) body.push(S.table(b.table.head, b.table.rows, b.table.widths), S.p(''))
      else if (b.fig) {
        const meta = path.join(dir, `${b.fig}.json`)
        if (!fs.existsSync(meta)) { missing.push(b.fig); continue }
        const m = JSON.parse(fs.readFileSync(meta, 'utf8'))
        figN += 1
        body.push(...S.figure(path.join(dir, m.image), figN, b.caption ?? m.caption, m.marks, [...(m.steps ?? []), ...(b.steps ?? [])]))
      }
    }
  }

  content.sections.forEach((s, i) => {
    if (i === 0 || s.newPage) body.push(S.pageBreak())
    body.push(S.h1(`${i + 1}. ${s.title}`))
    renderBlocks(s.blocks)
  })
  let n = content.sections.length
  if (content.emails?.length) {
    body.push(S.h1(`${++n}. Emails you will receive`))
    body.push(...S.bullets(content.emails))
  }
  const recorded = fs.existsSync(path.join(dir, '_messages.json')) ? JSON.parse(fs.readFileSync(path.join(dir, '_messages.json'), 'utf8')) : []
  const msgs = [...(content.messages ?? [])]
  for (const r of recorded) if (!msgs.some((m) => m.text === r.text)) msgs.push(r)
  if (msgs.length) {
    body.push(S.h1(`${++n}. Messages and what to do`))
    body.push(S.table(['Message', 'What to do'], msgs.map((m) => [m.text, m.what]), [4600, 5000]))
  }
  if (missing.length) {
    console.error(`${role}: ${missing.length} figure(s) missing in ${dir}: ${missing.join(', ')}`)
    process.exitCode = 1
  }

  const doc = new Document({
    creator: 'Trail Analytics',
    title: `${content.title} – ${content.subtitle}`,
    styles: S.styles,
    features: { updateFields: false },
    sections: [{ properties: S.pageProps, ...S.headerFooter(`Credit Analyst 3.0 – ${content.subtitle}: ${content.title}`, `${CLIENT} · Trail Analytics`), children: body }],
  })
  const file = path.join(outDir, `Credit Analyst 3.0 - ${content.title}.docx`)
  fs.writeFileSync(file, await Packer.toBuffer(doc))
  console.log(`${file}  (${figN} figures)`)
}
