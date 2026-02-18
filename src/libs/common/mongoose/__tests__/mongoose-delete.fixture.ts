import { Type } from '@nestjs/common'
import { getModelToken, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, HardDelete, MongooseSchema } from 'common'
import { Model } from 'mongoose'
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

export type MongooseDeleteFixture<T> = { model: Model<T>; teardown: () => Promise<void> }

export async function createMongooseDeleteFixture<T>(cls: Type<T>) {
    const schema = createMongooseSchema(cls)

    const { close, module } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: 'schema', schema }])
        ]
    })

    const model = module.get<Model<HardDeleteSample | SoftDeleteSample>>(getModelToken('schema'))

    const teardown = async () => {
        await close()
    }

    return { model, teardown }
}
