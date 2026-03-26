import { CommonErrors } from '@mannercode/common'
import { ApplicationErrors } from 'applications'
import { SharedErrors } from 'common'
import { CoreErrors } from 'cores'
import { AppErrors } from '../../errors'

export const Errors = {
    ...CommonErrors,
    ...SharedErrors,
    ...AppErrors,
    ...ApplicationErrors,
    ...CoreErrors
}
