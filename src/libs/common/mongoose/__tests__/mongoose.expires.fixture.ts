import { getModelToken, MongooseModule, Schema as NestSchema, Prop } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { Model } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

@NestSchema()
export class ExpireSample extends MongooseSchema {
    @Prop({ index: true })
    sn: number

    @Prop({ expires: '500ms', default: Date.now })
    expiresAt: Date
}

export type MongooseExpiresFixture = { teardown: () => Promise<void>; model: Model<ExpireSample> }

export async function createMongooseExpiresFixture() {
    const schema = createMongooseSchema(ExpireSample)

    const testContext = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: 'schema', schema }])
        ]
    })

    const model = testContext.module.get<Model<ExpireSample>>(getModelToken('schema'))
    await model.syncIndexes()

    async function teardown() {
        await testContext?.close()
    }

    return { teardown, model }
}
