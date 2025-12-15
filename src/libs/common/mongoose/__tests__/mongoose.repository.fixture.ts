import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import {
    createMongooseSchema,
    mapDocToDto,
    MongooseRepository,
    MongooseSchema,
    padNumber
} from 'common'
import { HydratedDocument, Model } from 'mongoose'
import { createTestContext, getMongoTestConnection } from 'testlib'

@Schema({ toJSON: { virtuals: true } })
class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
}
type SampleDocument = HydratedDocument<Sample>
const SampleSchema = createMongooseSchema(Sample)

export class SampleDto {
    id: string
    name: string
}

export const maxTakeValue = 50

@Injectable()
class SamplesRepository extends MongooseRepository<Sample> {
    constructor(@InjectModel(Sample.name) readonly model: Model<Sample>) {
        super(model, maxTakeValue)
    }
}

export function sortByName(documents: SampleDto[]) {
    return documents.sort((a, b) => a.name.localeCompare(b.name))
}

export function sortByNameDescending(documents: SampleDto[]) {
    return documents.sort((a, b) => b.name.localeCompare(a.name))
}

export function createSample(repository: SamplesRepository) {
    const doc = repository.newDocument()
    doc.name = 'Sample-Name'
    return doc.save()
}

export async function createSamples(repository: SamplesRepository) {
    return Promise.all(
        Array.from({ length: 20 }, async (_unused, index) => {
            const doc = repository.newDocument()
            doc.name = `Sample-${padNumber(index, 3)}`
            return doc.save()
        })
    )
}

export function toDto(item: SampleDocument) {
    return mapDocToDto(item, SampleDto, ['id', 'name'])
}
export function toDtos(items: SampleDocument[]) {
    return items.map((item) => toDto(item))
}

export type MongooseRepositoryFixture = {
    teardown: () => Promise<void>
    repository: SamplesRepository
    BadRequestException: typeof BadRequestException
    NotFoundException: typeof NotFoundException
}

export async function createMongooseRepositoryFixture() {
    const { module, close } = await createTestContext({
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

    return { teardown, repository, BadRequestException, NotFoundException }
}
