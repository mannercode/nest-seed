import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, mapDocToDto, MongooseRepository, MongooseSchema } from 'common'
import { Model } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

@Schema({ toJSON: { virtuals: true } })
class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
}
const SampleSchema = createMongooseSchema(Sample)

export class SampleDto {
    id: string
    name: string
}

export const maxTakeValue = 50

export type MongooseRepositoryFixture = {
    BadRequestException: typeof BadRequestException
    NotFoundException: typeof NotFoundException
    repository: SamplesRepository
    teardown: () => Promise<void>
}

@Injectable()
class SamplesRepository extends MongooseRepository<Sample> {
    constructor(@InjectModel(Sample.name) readonly model: Model<Sample>) {
        super(model, maxTakeValue)
    }
}

export async function createMongooseRepositoryFixture() {
    const { close, module } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([{ name: Sample.name, schema: SampleSchema }])
        ],
        providers: [SamplesRepository]
    })

    const repository = module.get(SamplesRepository)

    const teardown = async () => {
        await close()
    }

    return { BadRequestException, NotFoundException, repository, teardown }
}

export async function createSample(repository: SamplesRepository) {
    const doc = repository.newDocument()
    doc.name = 'Sample-Name'
    await doc.save()

    return doc.toJSON()
}

export async function createSamples(repository: SamplesRepository) {
    return Promise.all(
        Array.from({ length: 20 }, async (_unused, index) => {
            const doc = repository.newDocument()
            doc.name = `Sample-${index.toString().padStart(3, '0')}`
            await doc.save()

            return doc.toJSON()
        })
    )
}

export function sortByName(documents: SampleDto[]) {
    return documents.sort((a, b) => a.name.localeCompare(b.name))
}
export function sortByNameDescending(documents: SampleDto[]) {
    return documents.sort((a, b) => b.name.localeCompare(a.name))
}

export function toDto(item: null | Sample) {
    if (item === null) return { id: '0', name: 'name' }

    return mapDocToDto(item, SampleDto, ['id', 'name'])
}

export function toDtos(items: Sample[]) {
    return items.map((item) => toDto(item))
}
