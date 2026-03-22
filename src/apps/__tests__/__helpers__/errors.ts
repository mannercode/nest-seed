import { CommonErrors } from '@mannercode/nest-common'
import { ApplicationErrors } from 'apps/applications'
import { CoreErrors } from 'apps/cores'
import { GatewayErrors } from 'apps/gateway'
import { SharedErrors } from 'common'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...GatewayErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
