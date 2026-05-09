import type { UserAuthPayload } from 'core'
import type { Request } from 'express'

export type UserAuthRequest = Request & { user: UserAuthPayload }
export type UserOptionalAuthRequest = Request & { user?: UserAuthPayload }
