import { ConfigService } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'

class TestConfigService extends BaseConfigService {
    public exposeGetString(key: string) {
        return this.getString(key)
    }

    public exposeGetNumber(key: string) {
        return this.getNumber(key)
    }
}

describe('BaseConfigService', () => {
    let mockConfigService: jest.Mocked<ConfigService>
    const testSchema = Joi.object({
        VALID_KEY: Joi.string().required(),
        NUMBER_KEY: Joi.string().required()
    })

    beforeEach(() => {
        mockConfigService = {
            get: jest.fn()
        } as unknown as jest.Mocked<ConfigService>
    })

    it('올바른 키로 문자열 값 조회', () => {
        mockConfigService.get.mockReturnValue('test-value')
        const service = new TestConfigService(mockConfigService, testSchema)

        const result = service.exposeGetString('VALID_KEY')
        expect(result).toBe('test-value')
        expect(mockConfigService.get).toHaveBeenCalledWith('VALID_KEY')
    })

    it('잘못된 키 접근 시 프로세스 종료', () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation()
        const consoleError = jest.spyOn(console, 'error').mockImplementation()

        const service = new TestConfigService(mockConfigService, testSchema)

        service.exposeGetString('INVALID_KEY')

        expect(consoleError).toHaveBeenCalledWith(
            'Configuration validation error: Key "INVALID_KEY" is not defined in the configSchema'
        )
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('문자열을 숫자로 변환', () => {
        mockConfigService.get.mockReturnValue('123')
        const service = new TestConfigService(mockConfigService, testSchema)

        const result = service.exposeGetNumber('NUMBER_KEY')
        expect(result).toBe(123)
    })
})
