import { Injectable, Module } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import {
    createMongooseSchema,
    createSchemaOptions,
    generateShortId,
    MongooseRepository,
    MongooseSchema,
    padNumber,
    SchemaJson
} from 'common'
import { HydratedDocument, Model } from 'mongoose'
import { createHttpTestContext } from 'testlib'

const omits = ['password'] as const
@Schema(createSchemaOptions({ json: { omits, includes: { timestamps: false } } }))
export class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string

    @Prop({ required: true })
    password: string
}

export const SampleSchema = createMongooseSchema(Sample, {})
export type SampleDocument = HydratedDocument<Sample>
export type SampleDto = SchemaJson<Sample, typeof omits>

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
    const testContext = await createHttpTestContext({
        imports: [
            MongooseModule.forRootAsync({
                useFactory: () => ({ uri, dbName: 'test_' + generateShortId() })
            }),
            SampleModule
        ]
    })

    const repository = testContext.module.get(SamplesRepository)

    return { testContext, repository }
}

export const sortByName = (documents: SampleDto[]) =>
    documents.sort((a, b) => a.name.localeCompare(b.name))

export const sortByNameDescending = (documents: SampleDto[]) =>
    documents.sort((a, b) => b.name.localeCompare(a.name))

export const createSample = (repository: SamplesRepository) => {
    const doc = repository.newDocument()
    doc.name = 'Sample-Name'
    doc.password = 'password'
    return doc.save()
}

export const createSamples = async (repository: SamplesRepository) =>
    Promise.all(
        Array.from({ length: 20 }, async (_, index) => {
            const doc = repository.newDocument()
            doc.name = `Sample-${padNumber(index, 3)}`
            doc.password = 'password'
            return doc.save()
        })
    )

export function toDto(item: SampleDocument) {
    return item.toJSON<SampleDto>()
}

export function toDtos(items: SampleDocument[]) {
    return items.map((item) => toDto(item))
}
