import { Injectable, Module } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import {
    createMongooseSchema,
    generateShortId,
    MongooseRepository,
    MongooseSchema,
    ObjectId,
    padNumber
} from 'common'
import { Model } from 'mongoose'
import { createTestingModule } from 'testlib'

@Schema()
export class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string

    @Prop({ required: true })
    objId: ObjectId
}

export const SampleSchema = createMongooseSchema(Sample)

export class SampleDto {
    id: string
    name: string

    constructor(sample: Sample) {
        const { id, name } = sample
        Object.assign(this, { id: id.toString(), name })
    }
}

@Injectable()
export class SamplesRepository extends MongooseRepository<Sample> {
    constructor(@InjectModel(Sample.name) model: Model<Sample>) {
        super(model)
    }
}

@Module({
    imports: [MongooseModule.forFeature([{ name: Sample.name, schema: SampleSchema }])],
    providers: [SamplesRepository]
})
export class SampleModule {}

export async function createFixture(uri: string) {
    const module = await createTestingModule({
        imports: [
            MongooseModule.forRootAsync({
                useFactory: () => ({
                    uri,
                    dbName: 'test_' + generateShortId(),
                    autoIndex: true,
                    autoCreate: false,
                    bufferCommands: true
                })
            }),
            SampleModule
        ]
    })
    const app = module.createNestApplication()
    await app.init()

    const repository = module.get(SamplesRepository)
    const close = async () => await module.close()

    return { module, repository, close }
}

export const sortByName = (documents: SampleDto[]) =>
    documents.sort((a, b) => a.name.localeCompare(b.name))

export const sortByNameDescending = (documents: SampleDto[]) =>
    documents.sort((a, b) => b.name.localeCompare(a.name))

export const createSample = (repository: SamplesRepository) => {
    const doc = repository.newDocument()
    doc.name = 'Sample-Name'
    doc.objId = new ObjectId()
    return doc.save()
}

export const createSamples = async (repository: SamplesRepository) =>
    Promise.all(
        Array.from({ length: 20 }, async (_, index) => {
            const doc = repository.newDocument()
            doc.name = `Sample-${padNumber(index, 3)}`
            doc.objId = new ObjectId()
            return doc.save()
        })
    )
