import { CommonErrors } from '@mannercode/nestlib-common'
import { ApplicationErrors } from 'apps/applications'
import { CoreErrors } from 'apps/cores'
import { GatewayErrors } from 'apps/gateway'
import { SharedErrors } from 'shared'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
