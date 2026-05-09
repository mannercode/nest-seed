import { CommonErrors } from '@mannercode/common'
import { ApplicationErrors } from 'application'
import { CoreErrors } from 'core'
import { SharedErrors } from 'gateway'
import { GatewayErrors } from '../../../errors'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
