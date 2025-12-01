import { Type } from '@nestjs/common'
import { getModelToken, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, HardDelete, MongooseSchema } from 'common'
import { HydratedDocument, Model } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

@HardDelete()
@Schema()
export class HardDeleteSample extends MongooseSchema {
    @Prop()
    name: string
}

@Schema()
export class SoftDeleteSample extends MongooseSchema {
    @Prop()
    name: string
}

export type Fixture<T> = {
    teardown: () => Promise<void>
    model: Model<T>
    doc: HydratedDocument<T>
}

export async function createFixture<T>(cls: Type<T>) {
    const schema = createMongooseSchema(cls)

    const { uri, dbName } = getMongoTestConnection()

    const testContext = await createTestContext({
        metadata: {
            imports: [
                MongooseModule.forRootAsync({
                    useFactory() {
                        return { uri, dbName }
                    }
                }),
                MongooseModule.forFeature([{ name: 'schema', schema }])
            ]
        }
    })

    const model = testContext.module.get<Model<HardDeleteSample | SoftDeleteSample>>(
        getModelToken('schema')
    )

    const doc = new model()
    doc.name = 'name'
    await doc.save()

    async function teardown() {
        await testContext?.close()
    }

    return { teardown, model, doc }
}
