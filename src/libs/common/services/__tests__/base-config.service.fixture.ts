import { Injectable } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'
import { createTestContext } from 'testlib'

const configSchema = Joi.object({
    TEST_STRING_KEY: Joi.string().required(),
    TEST_NUMBER_KEY: Joi.number().required(),
    TEST_BOOLEAN_KEY: Joi.boolean().required()
})

@Injectable()
export class AppConfigService extends BaseConfigService {
    constructor(configService: ConfigService) {
        super(configService)
    }
}

export type BaseConfigServiceFixture = {
    teardown: () => Promise<void>
    appConfigService: AppConfigService
}

export async function createBaseConfigServiceFixture() {
    process.env['TEST_STRING_KEY'] = 'value'
    process.env['TEST_NUMBER_KEY'] = '123'
    process.env['TEST_BOOLEAN_KEY'] = 'true'

    const { module, close } = await createTestContext({
        imports: [ConfigModule.forRoot({ validationSchema: configSchema })],
        providers: [AppConfigService]
    })

    const appConfigService = module.get(AppConfigService)

    async function teardown() {
        await close()
    }

    return { teardown, appConfigService }
}
