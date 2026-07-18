import { CommonErrors } from '@mannercode/common'
import { ApplicationErrors } from 'application'
import { CoreErrors } from 'core'
import { GatewayErrors, SharedErrors } from 'gateway'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
