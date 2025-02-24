import { getModelToken, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { Model } from 'mongoose'
import { createHttpTestContext, getMongoTestConnection, withTestId } from 'testlib'

@Schema()
export class SchemaSample extends MongooseSchema {
    @Prop()
    name: string
}

export async function createFixture() {
    const schema = createMongooseSchema(SchemaSample)

    const { uri } = getMongoTestConnection()

    const testContext = await createHttpTestContext({
        imports: [
            MongooseModule.forRootAsync({
                useFactory: () => ({ uri, dbName: withTestId('test') })
            }),
            MongooseModule.forFeature([{ name: 'schema', schema }])
        ]
    })

    const model = testContext.module.get<Model<SchemaSample>>(getModelToken('schema'))

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, model }
}
