import { createCrudSchema, CrudSchema, HardDelete } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'
import type { ValidateAndCreateResult } from '../types'

@HardDelete()
@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class ShowtimeCreationOperation extends CrudSchema {
    @Prop({ required: true })
    inputHash: string

    @Prop({ required: true, type: Object })
    result: ValidateAndCreateResult

    @Prop({ required: true })
    sagaId: string
}

export const ShowtimeCreationOperationSchema = createCrudSchema(ShowtimeCreationOperation)

// 같은 saga의 Activity 재실행은 하나의 저장 결과에만 수렴한다.
ShowtimeCreationOperationSchema.index({ sagaId: 1 }, { unique: true })
