import { getModelToken, MongooseModule, Schema as NestSchema, Prop } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { Model } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

@NestSchema()
export class ExpireSample extends MongooseSchema {
    @Prop({ default: Date.now, expires: '500ms' })
    expiresAt: Date

    @Prop({ index: true })
    sn: number
}

export type MongooseExpiresFixture = { model: Model<ExpireSample>; teardown: () => Promise<void> }

export async function createMongooseExpiresFixture() {
    const schema = createMongooseSchema(ExpireSample)

    const { close, module } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: 'schema', schema }])
        ]
    })

    const model = module.get<Model<ExpireSample>>(getModelToken('schema'))
    await model.syncIndexes()

    const teardown = async () => {
        await close()
    }

    return { model, teardown }
}
