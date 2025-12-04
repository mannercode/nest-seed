import { getModelToken, MongooseModule, Schema as NestSchema, Prop } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { Model, mongo, Schema, Types } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

type RawSample = Partial<SchemaTypeSample> & { [key: string]: any }

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
    @Prop({ index: true, required: true })
    sn: number

    @Prop({
        // https://mongoosejs.com/docs/guide.html#collation
        collation: { locale: 'en_US', strength: 1 }
    })
    name: string

    @Prop({ min: 18, max: 65 })
    age: number

    @Prop({ default: Date.now })
    updated: Date

    @Prop()
    binary: Buffer

    @Prop()
    living: boolean

    @Prop({ type: Schema.Types.Mixed })
    mixed: any

    @Prop({ type: Schema.Types.ObjectId })
    someId: Types.ObjectId

    @Prop({ type: [Schema.Types.Mixed] })
    array: any[]

    @Prop()
    ofString: string[]

    @Prop()
    ofNumber: number[]

    @Prop()
    ofDates: Date[]

    @Prop()
    ofBuffer: Buffer[]

    @Prop({ type: [Schema.Types.Mixed] })
    ofMixed: any[]

    @Prop({ type: { stuff: { type: String, lowercase: true, trim: true } } })
    nested: { stuff: string }

    @Prop({ type: Map })
    map: Map<string, any>

    @Prop({ type: Schema.Types.Decimal128 })
    decimal: Types.Decimal128

    @Prop()
    optional?: boolean
}

export type MongooseSchemaFixture = {
    teardown: () => Promise<void>
    model: Model<SchemaTypeSample>
}

export async function createMongooseSchemaFixture() {
    const schema = createMongooseSchema(SchemaTypeSample)

    const testContext = await createTestContext({
        metadata: {
            imports: [
                MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
                MongooseModule.forFeature([{ name: 'schema', schema }])
            ]
        }
    })

    const model = testContext.module.get<Model<SchemaTypeSample>>(getModelToken('schema'))

    async function teardown() {
        await testContext?.close()
    }

    return { teardown, model }
}
