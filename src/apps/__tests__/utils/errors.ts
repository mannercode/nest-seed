import { ApplicationsErrors } from 'applications/application-errors'
import { CommonErrors } from 'common'
import { CoreErrors } from 'cores/core-errors'
import { GatewayErrors } from 'gateway/gateway-errors'

export const Errors = {
    ...CommonErrors,
    ...GatewayErrors,
    ...ApplicationsErrors,
    ...CoreErrors
}
