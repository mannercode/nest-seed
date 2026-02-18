import { getModelToken, MongooseModule, Schema as NestSchema, Prop } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { Model, Types } from 'mongoose'
import { mongo, Schema } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

export type MongooseSchemaFixture = {
    model: Model<SchemaTypeSample>
    teardown: () => Promise<void>
}

@NestSchema({
    toJSON: {
        transform: (_doc: RawSample, ret: RawSample) => {
            if (Array.isArray(ret.ofBuffer)) {
                // Even if stored as Buffer, it is recognized as mongo.Binary when loaded.
                // Buffer로 저장해도 로드하면 mongo.Binary 타입이다.
                ret.ofBuffer = ret.ofBuffer.map((b: any) =>
                    b instanceof mongo.Binary ? b.buffer : b
                )
            }
            return ret
        }
    }
})
export class SchemaTypeSample extends MongooseSchema {
    @Prop({ max: 65, min: 18 })
    age: number

    @Prop({ type: [Schema.Types.Mixed] })
    array: any[]

    @Prop()
    binary: Buffer

    @Prop({ type: Schema.Types.Decimal128 })
    decimal: Types.Decimal128

    @Prop()
    living: boolean

    @Prop({ type: Map })
    map: Map<string, any>

    @Prop({ type: Schema.Types.Mixed })
    mixed: any

    @Prop({
        // https://mongoosejs.com/docs/guide.html#collation
        collation: { locale: 'en_US', strength: 1 }
    })
    name: string

    @Prop({ type: { stuff: { lowercase: true, trim: true, type: String } } })
    nested: { stuff: string }

    @Prop()
    ofBuffer: Buffer[]

    @Prop()
    ofDates: Date[]

    @Prop({ type: [Schema.Types.Mixed] })
    ofMixed: any[]

    @Prop()
    ofNumber: number[]

    @Prop()
    ofString: string[]

    @Prop()
    optional?: boolean

    @Prop({ index: true, required: true })
    sn: number

    @Prop({ type: Schema.Types.ObjectId })
    someId: Types.ObjectId

    @Prop({ default: Date.now })
    updated: Date
}

type RawSample = Partial<SchemaTypeSample> & { [key: string]: any }

export async function createMongooseSchemaFixture() {
    const schema = createMongooseSchema(SchemaTypeSample)

    const { close, module } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: 'schema', schema }])
        ]
    })

    const model = module.get<Model<SchemaTypeSample>>(getModelToken('schema'))

    const teardown = async () => {
        await close()
    }

    return { model, teardown }
}
