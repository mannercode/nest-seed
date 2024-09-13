import { expect } from '@jest/globals'
import { TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrderDirection, TypeormException, nullUUID } from 'common'
import { createTestingModule } from 'common'
import {
    Sample,
    SamplesModule,
    SamplesRepository,
    baseFields,
    createSamples,
    sortByName,
    sortByNameDescending
} from './typeorm.repository.fixture'

describe('TypeormRepository', () => {
    let module: TestingModule
    let repository: SamplesRepository

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

        repository = module.get(SamplesRepository)
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    describe('create', () => {
        it('should successfully create a entity', async () => {
            const entity = await repository.create({
                name: 'entity name'
            })

            expect(entity).toEqual({
                ...baseFields,
                name: 'entity name'
            })
        })

        it('should throw an exception if required fields are missing', async () => {
            const promise = repository.create({})

            await expect(promise).rejects.toThrowError()
        })
    })

    describe('update', () => {
        let sample: Sample

        beforeEach(async () => {
            const samples = await createSamples(repository, 1)
            sample = samples[0]
        })

        it('should successfully update a entity', async () => {
            const entity = await repository.update(sample.id, { name: 'new name' })

            expect(entity).toEqual({ ...baseFields, name: 'new name' })
        })

        it('should throw an exception if the ID does not exist', async () => {
            const promise = repository.update(nullUUID, {})

            await expect(promise).rejects.toThrow(TypeormException)
        })
    })

    describe('deleteById', () => {
        let sample: Sample

        beforeEach(async () => {
            const samples = await createSamples(repository, 1)
            sample = samples[0]
        })

        it('should delete a entity successfully', async () => {
            await repository.deleteById(sample.id)

            const entity = await repository.findById(sample.id)

            expect(entity).toBeNull()
        })

        it('should throw an exception if the ID does not exist', async () => {
            const promise = repository.deleteById(nullUUID)

            await expect(promise).rejects.toThrow(TypeormException)
        })
    })

    describe('existsById', () => {
        let sample: Sample

        beforeEach(async () => {
            const samples = await createSamples(repository, 1)
            sample = samples[0]
        })

        it('should return true if the ID does exist', async () => {
            const exists = await repository.existsById(sample.id)

            expect(exists).toBeTruthy()
        })

        it('should return false if the ID does not exist', async () => {
            const exists = await repository.existsById(nullUUID)

            expect(exists).toBeFalsy()
        })
    })

    describe('findById', () => {
        let sample: Sample

        beforeEach(async () => {
            const samples = await createSamples(repository, 1)
            sample = samples[0]
        })

        it('should find a entity by ID', async () => {
            const entity = await repository.findById(sample.id)

            expect(entity).toEqual(sample)
        })

        it('should return null if the ID does not exist', async () => {
            const entity = await repository.findById(nullUUID)

            expect(entity).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: Sample[]

        beforeEach(async () => {
            samples = await createSamples(repository, 10)
        })

        it('should find entitys by multiple IDs', async () => {
            const ids = samples.map((entity) => entity.id)

            const foundDocuments = await repository.findByIds(ids)

            expect(foundDocuments).toEqual(expect.arrayContaining(samples))
        })

        it('should ignore non-existent IDs', async () => {
            const entities = await repository.findByIds([nullUUID])

            expect(entities).toHaveLength(0)
        })
    })

    describe('findByFilter', () => {
        let samples: Sample[]

        beforeEach(async () => {
            samples = await createSamples(repository, 20)
        })

        it('should return all documents if no filter is specified', async () => {
            const entities = await repository.findByFilter({})

            expect(entities).toEqual(expect.arrayContaining(samples))
        })

        it('should return entities matching the specified filter', async () => {
            const entities = await repository.findByFilter({ name: 'Sample-001' })

            expect(entities[0].name).toEqual('Sample-001')
        })
    })

    describe('findWithPagination', () => {
        let samples: Sample[]

        beforeEach(async () => {
            samples = await createSamples(repository, 20)
        })

        it('should set the pagination correctly', async () => {
            const skip = 10
            const take = 5
            const paginated = await repository.findWithPagination({
                skip,
                take,
                orderby: { name: 'name', direction: OrderDirection.asc }
            })

            sortByName(samples)

            expect(paginated).toEqual({
                items: samples.slice(skip, skip + take),
                total: samples.length,
                skip,
                take
            })
        })

        it('should sort in ascending order', async () => {
            const paginated = await repository.findWithPagination({
                orderby: { name: 'name', direction: OrderDirection.asc }
            })

            sortByName(samples)

            expect(paginated.items).toEqual(samples)
        })

        it('should sort in descending order', async () => {
            const paginated = await repository.findWithPagination({
                orderby: { name: 'name', direction: OrderDirection.desc }
            })

            sortByNameDescending(samples)

            expect(paginated.items).toEqual(samples)
        })

        it('should throw an exception if ‘take’ is absent or zero', async () => {
            const promise = repository.findWithPagination({ take: 0 })

            await expect(promise).rejects.toThrow(TypeormException)
        })

        it('Should set conditions using the QueryBuilder', async () => {
            const paginated = await repository.findWithPagination({}, (qb) => {
                qb.where('entity.name LIKE :name', { name: '%Sample-00%' })
            })

            const names = paginated.items.map((item) => item.name)

            expect(names).toEqual(
                expect.arrayContaining([
                    'Sample-000',
                    'Sample-001',
                    'Sample-002',
                    'Sample-003',
                    'Sample-004',
                    'Sample-005',
                    'Sample-006',
                    'Sample-007',
                    'Sample-008',
                    'Sample-009'
                ])
            )
        })
    })
})
