import { CommonErrors } from '@mannercode/common'
import { ApplicationErrors } from 'applications'
import { SharedErrors } from 'config'
import { CoreErrors } from 'cores'
import { GatewayErrors } from 'gateway'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
