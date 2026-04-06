import type { Request } from 'express'
import type { CustomerAuthPayload } from '../dtos'

export type CustomerAuthRequest = Request & { user: CustomerAuthPayload }
export type CustomerOptionalAuthRequest = Request & { user?: CustomerAuthPayload }
