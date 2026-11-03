import { CommonErrors } from '@mannercode/common'
import { CoreErrors } from '#core'
import { GatewayErrors, SharedErrors } from '#gateway'

export const Errors = { ...CommonErrors, ...SharedErrors, ...GatewayErrors, ...CoreErrors }
