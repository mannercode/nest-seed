import type { Request } from 'express'
import type { UserAuthPayload } from '#core'

export type UserAuthRequest = Request & { user: UserAuthPayload }
