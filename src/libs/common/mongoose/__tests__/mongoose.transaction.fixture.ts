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

export type Fixture = {
    teardown: () => Promise<void>
    repository: SamplesRepository
    model: Model<Sample>
}

export async function createFixture() {
    const { uri, dbName } = getMongoTestConnection()

    const testContext = await createTestContext({
        metadata: {
            imports: [
                MongooseModule.forRootAsync({
                    useFactory() {
                        return { uri, dbName }
                    }
                }),
                MongooseModule.forFeature([{ name: Sample.name, schema: SampleSchema }])
            ],
            providers: [SamplesRepository]
        }
    })

    const repository = testContext.module.get(SamplesRepository)
    const model = testContext.module.get(getModelToken(Sample.name))
    async function teardown() {
        await testContext?.close()
    }

    return { teardown, repository, model }
}
