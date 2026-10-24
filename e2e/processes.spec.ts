import { expect, test, type Page, type Route } from '@playwright/test'

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const me = (permissions: string[]) => ({
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions,
})

async function signIn(page: Page, permissions: string[]) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions)))
  await page.route('**/api/v1/reference/**', (r) => json(r, []))
}

const row = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'cba_generation',
  title: `CBA Report Generation (2026093${id})`,
  status: 'processing',
  progress: 42,
  progress_label: 'Processing loan accounts... (300/650) | ETA: 12s',
  error_message: null,
  has_file: false,
  result_url: null,
  started_at: '24 Oct 2026 10:00',
  created_at: '24 Oct 2026 09:59',
  completed_at: null,
  user_name: 'Jane Doe',
  ...extra,
})

const paged = (data: unknown[], lastPage = 1) => ({
  data,
  current_page: 1,
  last_page: lastPage,
  per_page: 20,
  total: data.length,
  from: 1,
  to: data.length,
})

test('a running process is polled every few seconds until its file is ready, then downloaded', async ({
  page,
}) => {
  await page.clock.install()
  await signIn(page, [])
  await page.route('**/api/v1/background-processes?**', (r) => json(r, paged([row(7)])))
  let polls = 0
  await page.route('**/api/v1/background-processes/7', (r) => {
    polls += 1
    return json(
      r,
      polls < 2
        ? { ...row(7), progress: 80, progress_label: 'Processing loan accounts... (520/650) | ETA: 3s' }
        : {
            ...row(7),
            status: 'completed',
            progress: 100,
            progress_label: 'CBA report generated successfully.',
            has_file: true,
            completed_at: '24 Oct 2026 10:03',
          },
    )
  })
  await page.route('**/api/v1/background-processes/7/download', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'content-disposition': 'attachment; filename="CB01120260930CBA.csv"' },
      body: '"H"|"CB011"\n',
    }),
  )
  await page.goto('/background-processes')
  const process = page.getByTestId('process-7')
  await expect(process).toContainText('CBA Report Generation (20260937)')
  await expect(process).toContainText('Processing')
  await expect(process).toContainText('(300/650)')
  // no manage column for someone who only sees their own processes
  await expect(page.getByTestId('kill')).toHaveCount(0)

  await page.clock.fastForward(4100)
  await expect(process).toContainText('(520/650)')
  await page.clock.fastForward(4100)
  await expect(process.getByTestId('badge')).toHaveText('Completed')
  await expect(process).toContainText('CBA report generated successfully.')

  const download = page.waitForEvent('download')
  await process.getByTestId('download').click()
  expect((await download).suggestedFilename()).toBe('CB01120260930CBA.csv')
})

test('a manager kills a stuck process after confirming and sees the answer', async ({ page }) => {
  await signIn(page, ['Manage Background Processes'])
  let killed = false
  await page.route('**/api/v1/background-processes?**', (r) =>
    json(
      r,
      paged([
        killed
          ? row(5, {
              status: 'failed',
              error_message: 'Killed by Jane Doe on 24 Oct 2026 10:05',
              progress: 42,
            })
          : row(5, { status: 'pending', progress: 0, progress_label: 'Queued...', started_at: null }),
      ]),
    ),
  )
  await page.route('**/api/v1/background-processes/5', (r) => json(r, row(5, { status: 'pending' })))
  await page.route('**/api/v1/background-processes/5/kill', (r) => {
    killed = true
    return json(r, { message: 'Process killed successfully.' })
  })
  await page.goto('/background-processes')
  const process = page.getByTestId('process-5')
  await expect(process).toContainText('24 Oct 2026 09:59 (queued)')
  await expect(process.getByTestId('override')).toBeVisible()
  await process.getByTestId('kill').click()
  await expect(page.getByText('Stop and mark')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, Kill It' }).click()
  await expect(page.getByText('Process killed successfully.')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(process.getByTestId('badge')).toHaveText('Failed')
  await expect(process.getByTestId('error')).toContainText('Killed by Jane Doe')
  await expect(process.getByTestId('kill')).toHaveCount(0)
})

test('the home tile shows how many processes are running', async ({ page }) => {
  await signIn(page, ['View Analysis'])
  await page.route('**/api/v1/background-processes/active-count', (r) => json(r, { count: 3 }))
  await page.goto('/home')
  await expect(page.getByTestId('tile-badge')).toHaveText('3')
  await expect(page.getByRole('link', { name: /PROCESSES/ })).toHaveAttribute('href', '/background-processes')
})
