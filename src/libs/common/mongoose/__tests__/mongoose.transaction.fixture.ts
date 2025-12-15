import { Injectable } from '@nestjs/common'
import { getModelToken, InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseRepository, MongooseSchema } from 'common'
import { Model } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

@Schema()
class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
}

const SampleSchema = createMongooseSchema(Sample)

@Injectable()
class SamplesRepository extends MongooseRepository<Sample> {
    constructor(@InjectModel(Sample.name) readonly model: Model<Sample>) {
        super(model, 1)
    }
}

export type MongooseTransactionFixture = {
    teardown: () => Promise<void>
    repository: SamplesRepository
    model: Model<Sample>
}

export async function createMongooseTransactionFixture() {
    const { module, close } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: Sample.name, schema: SampleSchema }])
        ],
        providers: [SamplesRepository]
    })

    const repository = module.get(SamplesRepository)
    const model = module.get(getModelToken(Sample.name))
    async function teardown() {
        await close()
    }

    return { teardown, repository, model }
}
