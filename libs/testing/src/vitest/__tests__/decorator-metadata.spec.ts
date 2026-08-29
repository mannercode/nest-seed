import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'

@Injectable()
class MetadataDependency {}

@Injectable()
class MetadataConsumer {
    constructor(readonly dependency: MetadataDependency) {}
}

describe('TypeScript 기반 Vitest 변환', () => {
    it('Nest 생성자 타입 metadata를 내보내고 실제 DI에 사용한다', async () => {
        expect(Reflect.getMetadata('design:paramtypes', MetadataConsumer)).toEqual([
            MetadataDependency
        ])

        const module = await Test.createTestingModule({
            providers: [MetadataConsumer, MetadataDependency]
        }).compile()

        expect(module.get(MetadataConsumer).dependency).toBeInstanceOf(MetadataDependency)
        await module.close()
    })
})
