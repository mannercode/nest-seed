import { Injectable, Module } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
    defaultSchemaOption,
    generateShortId,
    MongooseRepository,
    MongooseSchema,
    padNumber,
    SchemaJson
} from 'common'
import { HydratedDocument, Model } from 'mongoose'
import * as mongooseDelete from 'mongoose-delete'
import { createTestingModule } from 'testlib'

@Schema(defaultSchemaOption)
export class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
}

export const SampleSchema = SchemaFactory.createForClass(Sample)
SampleSchema.index({ name: 'text' })
SampleSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' })

export type SampleDocument = HydratedDocument<Sample>

export type SampleDto = SchemaJson<Sample>

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
