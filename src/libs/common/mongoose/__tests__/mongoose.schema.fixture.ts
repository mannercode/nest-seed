import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { generateShortId } from 'common'
import { SoftDeleteModel } from 'mongoose-delete'
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

    const model = testContext.module.get<SoftDeleteModel<any>>(getModelToken('schema'))

    return { testContext, model }
}
