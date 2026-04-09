import { createTestContext, getMongoTestConnection } from '@mannercode/testing'
import { Type } from '@nestjs/common'
import { getModelToken, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { createCrudSchema, CrudSchema, HardDelete } from '../crud.schema'

@HardDelete()
@Schema()
export class HardDeleteSample extends CrudSchema {
    @Prop()
    name: string
}

@Schema()
export class SoftDeleteSample extends CrudSchema {
    @Prop()
    name: string
}

export type CrudDeleteFixture<T> = { model: Model<T>; teardown: () => Promise<void> }

export async function createCrudDeleteFixture<T>(cls: Type<T>) {
    const schema = createCrudSchema(cls)

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
