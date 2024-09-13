import { Injectable, Module } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseRepository, MongooseSchema, padNumber } from 'common'
import { createTestingModule } from 'common'
import { Connection, Model } from 'mongoose'

@Schema()
export class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
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

    /*
    Issue   : document.save() internally calls createCollection
    Symptom : Concurrent save() calls can cause "Collection namespace is already in use" errors.
              (more frequent in transactions)
    Solution: "await this.model.createCollection()"
    Note    : This problem mainly occurs in unit test environments with frequent initializations
    Ref     : https://mongoosejs.com/docs/api/model.html#Model.createCollection()
    */
    async onModuleInit() {
        await this.model.createCollection()
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
            MongooseModule.forRoot(uri, {
                autoIndex: true,
                autoCreate: false,
                bufferCommands: true,
                connectionFactory: async (connection: Connection) => {
                    await connection.dropDatabase()
                    return connection
                }
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
    return doc.save()
}

export const createSamples = async (repository: SamplesRepository) =>
    Promise.all(
        Array.from({ length: 20 }, async (_, index) => {
            const doc = repository.newDocument()
            doc.name = `Sample-${padNumber(index, 3)}`
            return doc.save()
        })
    )
