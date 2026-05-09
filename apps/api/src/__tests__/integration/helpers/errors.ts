import { CommonErrors } from '@mannercode/common'
import { ApplicationErrors } from 'application'
import { SharedErrors } from 'config'
import { CoreErrors } from 'core'
import { GatewayErrors } from '../../../errors'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
