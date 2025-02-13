import { Injectable, Module } from '@nestjs/common'
import { InjectModel, MongooseModule, Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, generateShortId, MongooseRepository, MongooseSchema } from 'common'
import express from 'express'
import { HydratedDocument, Model } from 'mongoose'
import { createTestContext } from 'testlib'

@Schema()
export class Sample extends MongooseSchema {
    @Prop({ required: true })
    name: string
}

export const SampleSchema = createMongooseSchema(Sample)
export type SampleDocument = HydratedDocument<Sample>

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
    const testContext = await createTestContext({
        metadata: {
            imports: [
                MongooseModule.forRootAsync({
                    useFactory: () => ({ uri, dbName: 'test_' + generateShortId() })
                }),
                SampleModule
            ]
        },
        configureApp: async (app) => {
            app.use(express.urlencoded({ extended: true }))
        }
    })

    const repository = testContext.module.get(SamplesRepository)

    return { testContext, repository }
}
