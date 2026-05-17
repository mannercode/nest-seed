import type { AdminAuthPayload, UserAuthPayload } from 'core'
import type { Request } from 'express'

export type AdminAuthRequest = Request & { user: AdminAuthPayload }
export type UserAuthRequest = Request & { user: UserAuthPayload }
export type UserOptionalAuthRequest = Request & { user?: UserAuthPayload }
