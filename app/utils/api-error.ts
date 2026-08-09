// Auto-imported (app/utils/*) — dilempar oleh useApi saat backend membalas non-2xx.
export class ApiError extends Error {
  statusCode: number
  errors?: Record<string, string[]>

  constructor(message: string, statusCode: number, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errors = errors
  }
}
