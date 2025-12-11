import { CustomerAuthPayload } from 'apps/cores'
import { Request } from 'express'

export type CustomerAuthRequest = Request & { user: CustomerAuthPayload }
