import { TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TypeormTransactionService } from 'common'
import { createTestingModule } from 'common'
import { Sample, SamplesModule, SamplesRepository } from './typeorm.transaction.service.fixture'

describe('TypeormTransactionService', () => {
    let module: TestingModule
    let transactionService: TypeormTransactionService
    let sampleRepository: SamplesRepository

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    synchronize: true,
                    autoLoadEntities: true
                }),
                SamplesModule
            ]
        })

        transactionService = await module.resolve(TypeormTransactionService)
        sampleRepository = module.get(SamplesRepository)
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    it('create in transaction', async () => {
        let createdEntity!: Sample

        await transactionService.execute(async (transaction) => {
            createdEntity = await transaction.create(Sample, { name: 'Create Sample' })
        })

        const foundEntity = await sampleRepository.findById(createdEntity.id)

        expect(foundEntity).toEqual(createdEntity)
    })

    it('update in transaction', async () => {
        let updatedEntity!: Sample

        await transactionService.execute(async (transaction) => {
            const createdEntity = await transaction.create(Sample, { name: 'Create Sample' })
            createdEntity.name = 'Updated Name'

            updatedEntity = await transaction.update(createdEntity)
        })

        const foundEntity = await sampleRepository.findById(updatedEntity.id)

        expect(foundEntity).toEqual(updatedEntity)
        expect(foundEntity?.name).toEqual('Updated Name')
    })

    it('delete in transaction', async () => {
        let createdEntity!: Sample

        await transactionService.execute(async (transaction) => {
            createdEntity = await transaction.create(Sample, { name: 'Create Sample' })

            await transaction.delete(createdEntity)
        })

        const foundEntity = await sampleRepository.findById(createdEntity.id)

        expect(foundEntity).toBeNull()
    })

    it('rollback a transaction', async () => {
        let createdEntity!: Sample

        await transactionService.execute(async (transaction) => {
            createdEntity = await transaction.create(Sample, { name: 'Create Sample' })

            transaction.rollback()
        })

        const foundEntity = await sampleRepository.findById(createdEntity.id)

        expect(foundEntity).toBeNull()
    })
})
