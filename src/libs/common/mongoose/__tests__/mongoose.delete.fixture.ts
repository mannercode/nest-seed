import { Type } from '@nestjs/common'
import { getModelToken, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, HardDelete, MongooseSchema } from 'common'
import { Model } from 'mongoose'
import { createHttpTestContext, getMongoTestConnection, withTestId } from 'testlib'

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

export async function createFixture<T>(cls: Type<T>) {
    const schema = createMongooseSchema(cls)

    const { uri } = getMongoTestConnection()

    const testContext = await createHttpTestContext({
        imports: [
            MongooseModule.forRootAsync({
                useFactory: () => ({ uri, dbName: withTestId('test') })
            }),
            MongooseModule.forFeature([{ name: 'schema', schema }])
        ]
    })

    const model = testContext.module.get<Model<any>>(getModelToken('schema'))
    const doc = new model()
    doc.name = 'name'
    await doc.save()

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, model, doc }
}
