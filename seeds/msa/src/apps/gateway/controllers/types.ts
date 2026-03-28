import type { CustomerAuthPayload } from 'apps/cores'
import type { Request } from 'express'

export type CustomerAuthRequest = Request & { user: CustomerAuthPayload }
export type CustomerOptionalAuthRequest = Request & { user?: CustomerAuthPayload }
