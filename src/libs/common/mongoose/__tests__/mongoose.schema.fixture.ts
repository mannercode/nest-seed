import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { generateShortId } from 'common'
import { Model } from 'mongoose'
import { createHttpTestContext, getMongoTestConnection } from 'testlib'

@Module({})
class SampleModule {
    static forRoot(options: ModuleMetadata): DynamicModule {
        return { module: SampleModule, ...options }
    }
}

export async function createFixture(schema: any) {
    const uri = getMongoTestConnection()

    const testContext = await createHttpTestContext({
        imports: [
            MongooseModule.forRootAsync({
                useFactory: () => ({ uri, dbName: 'test_' + generateShortId() })
            }),
            SampleModule.forRoot({
                imports: [MongooseModule.forFeature([{ name: 'schema', schema }])]
            })
        ]
    })

    const model = testContext.module.get<Model<any>>(getModelToken('schema'))

    return { testContext, model }
}
