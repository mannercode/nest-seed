import { CrudDocument } from '@mannercode/common'
import type { ValidateAndCreateResult } from '../types.js'

export class ShowtimeCreationOperation extends CrudDocument {
    inputHash: string

    result: ValidateAndCreateResult

    sagaId: string
}
