import { ConfigModule } from '@nestjs/config'
import { TestingModule } from '@nestjs/testing'
import { AppConfigService } from 'shared'
import { createTestingModule } from 'testlib'

describe('AppConfigService', () => {
    let module: TestingModule
    let configService: AppConfigService

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [ConfigModule.forRoot({})],
            providers: [AppConfigService]
        })
        configService = module.get(AppConfigService)
    })

    afterEach(async () => {
        await module?.close()
    })

    it('dummy test for coverage', () => {
        expect(configService.services).not.toBeUndefined()
    })
})
