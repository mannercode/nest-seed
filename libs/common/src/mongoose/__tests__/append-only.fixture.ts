import { createTestContext, getMongoTestConnection } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { getModelToken, InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { AppendOnlyRepository } from '../append-only.repository'
import { AppendOnlySchema, createAppendOnlySchema } from '../append-only.schema'

@Schema({ toJSON: { virtuals: true } })
export class AppendOnlySample extends AppendOnlySchema {
    @Prop({ required: true })
    name: string
}
const AppendOnlySampleSchema = createAppendOnlySchema(AppendOnlySample)

@Injectable()
export class AppendOnlySamplesRepository extends AppendOnlyRepository<AppendOnlySample> {
    constructor(@InjectModel(AppendOnlySample.name) readonly model: Model<AppendOnlySample>) {
        super(model)
    }

    async append(name: string) {
        const doc = this.newDocument()
        doc.name = name
        await doc.save()
        return doc.toJSON()
    }
}

export type AppendOnlyFixture = {
    model: Model<AppendOnlySample>
    repository: AppendOnlySamplesRepository
    teardown: () => Promise<void>
}

export async function createAppendOnlyFixture(): Promise<AppendOnlyFixture> {
    const { close, module } = await createTestContext({
        imports: [
            MongooseModule.forRootAsync({ useFactory: () => getMongoTestConnection() }),
            MongooseModule.forFeature([
                { name: AppendOnlySample.name, schema: AppendOnlySampleSchema }
            ])
        ],
        providers: [AppendOnlySamplesRepository]
    })

    const model = module.get<Model<AppendOnlySample>>(getModelToken(AppendOnlySample.name))
    const repository = module.get(AppendOnlySamplesRepository)

    const teardown = async () => {
        await close()
    }

    return { model, repository, teardown }
}
