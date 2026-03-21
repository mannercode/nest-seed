import { CommonErrors } from '@mannercode/nest-common'
import { SharedErrors } from 'app-common'
import { ApplicationErrors } from 'apps/applications'
import { CoreErrors } from 'apps/cores'
import { GatewayErrors } from 'apps/gateway'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
