import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConfigModule } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'
import { createTestContext } from 'testlib'

const configSchema = Joi.object({
    TEST_BOOLEAN_FALSE_KEY: Joi.boolean().required(),
    TEST_BOOLEAN_KEY: Joi.boolean().required(),
    TEST_NUMBER_KEY: Joi.number().required(),
    TEST_NUMBER_ZERO_KEY: Joi.number().required(),
    TEST_STRING_KEY: Joi.string().required()
})

@Injectable()
export class AppConfigService extends BaseConfigService {
    constructor(configService: ConfigService) {
        super(configService)
    }
}

export type BaseConfigServiceFixture = {
    appConfigService: AppConfigService
    teardown: () => Promise<void>
}

export async function createBaseConfigServiceFixture() {
    const { close, module } = await createTestContext({
        imports: [ConfigModule.forRoot({ validationSchema: configSchema })],
        providers: [AppConfigService]
    })

    const appConfigService = module.get(AppConfigService)

    const teardown = async () => {
        await close()
    }

    return { appConfigService, teardown }
}
