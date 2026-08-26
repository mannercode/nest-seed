import { createCrudSchema, CrudSchema, HardDelete } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@HardDelete()
@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class ShowtimeCreationSubmission extends CrudSchema {
    @Prop({ default: null, type: Date })
    acceptedAt: Date | null

    @Prop({ default: null, type: String })
    claimId: null | string

    @Prop({ default: null, type: Date })
    claimUntil: Date | null

    @Prop({ required: true })
    idempotencyKey: string

    @Prop({ required: true })
    inputHash: string

    @Prop({ required: true })
    principalId: string

    @Prop({ required: true })
    sagaId: string
}

export const ShowtimeCreationSubmissionSchema = createCrudSchema(ShowtimeCreationSubmission)

ShowtimeCreationSubmissionSchema.index(
    { principalId: 1, idempotencyKey: 1 },
    { name: 'principal_idempotency_key_unique', unique: true }
)
ShowtimeCreationSubmissionSchema.index({ sagaId: 1 }, { unique: true })
