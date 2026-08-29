import { createTestContext } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { z } from 'zod'
import { BaseConfigService } from '../base-config.service.js'

const configSchema = z.object({
    TEST_BOOLEAN_FALSE_KEY: z
        .string()
        .trim()
        .pipe(z.stringbool({ falsy: ['false'], truthy: ['true'] })),
    TEST_BOOLEAN_KEY: z
        .string()
        .trim()
        .pipe(z.stringbool({ falsy: ['false'], truthy: ['true'] })),
    TEST_NUMBER_KEY: z.coerce.number(),
    TEST_NUMBER_ZERO_KEY: z.coerce.number(),
    TEST_STRING_KEY: z.string().min(1)
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
