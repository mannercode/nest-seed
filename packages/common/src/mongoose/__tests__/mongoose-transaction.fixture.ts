import { createTestContext, getMongoTestConnection } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { getModelToken, InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { MongooseRepository } from '../mongoose.repository'
import { createMongooseSchema, MongooseSchema } from '../mongoose.schema'

@Schema()
class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
}

const SampleSchema = createMongooseSchema(Sample)

export type MongooseTransactionFixture = {
    model: Model<Sample>
    repository: SamplesRepository
    teardown: () => Promise<void>
}

@Injectable()
class SamplesRepository extends MongooseRepository<Sample> {
    constructor(@InjectModel(Sample.name) readonly model: Model<Sample>) {
        super(model, 1)
    }
}

export async function createMongooseTransactionFixture() {
    const { close, module } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: Sample.name, schema: SampleSchema }])
        ],
        providers: [SamplesRepository]
    })

    const repository = module.get(SamplesRepository)
    const model = module.get(getModelToken(Sample.name))
    const teardown = async () => {
        await close()
    }

    return { model, repository, teardown }
}
