import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios'

/** The file name of a Content-Disposition header, else the fallback. */
export function filenameOf(
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
  fallback: string,
): string {
  return /filename="?([^";]+)"?/.exec(String(headers['content-disposition'] ?? ''))?.[1] ?? fallback
}

/** Saves a blob through a temporary link. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** A failed download answers with the problem details as a blob: its message, or the fallback. */
export async function blobFailure(error: unknown, fallback: string): Promise<string> {
  const data = (error as { response?: { data?: unknown } }).response?.data
  if (!(data instanceof Blob)) return fallback
  try {
    const problem = JSON.parse(await data.text()) as { detail?: string; errors?: Record<string, string[]> }
    const lines = problem.errors ? Object.values(problem.errors).flat() : []
    return lines.length ? lines.join('<br>') : (problem.detail ?? fallback)
  } catch {
    return fallback
  }
}
