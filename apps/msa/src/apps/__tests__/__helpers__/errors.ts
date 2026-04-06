import { CommonErrors } from '@mannercode/common'
import { ApplicationErrors } from 'applications'
import { SharedErrors } from 'config'
import { CoreErrors } from 'cores'

export const Errors = { ...CommonErrors, ...SharedErrors, ...ApplicationErrors, ...CoreErrors }
