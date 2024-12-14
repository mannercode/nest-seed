import { expect } from '@jest/globals'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { OrderDirection, pickIds, pickItems } from 'common'
import { expectEqualUnsorted, getMongoTestConnection, HttpTestContext, nullObjectId } from 'testlib'
import {
    createFixture,
    createSample,
    createSamples,
    SampleDto,
    SamplesRepository,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos
} from './mongoose.repository.fixture'

describe('MongooseRepository', () => {
    let testContext: HttpTestContext
    let repository: SamplesRepository

    beforeEach(async () => {
        const uri = getMongoTestConnection()

        const fixture = await createFixture(uri)
        testContext = fixture.testContext
        repository = fixture.repository
    })

    afterEach(async () => {
        await testContext?.close()
    })

    describe('save', () => {
        it('should successfully create a document', async () => {
            const newDoc = repository.newDocument()
            newDoc.name = 'document name'
            await newDoc.save()

            const findDoc = await repository.findById(newDoc.id)
            expect(toDto(findDoc!)).toEqual(toDto(newDoc))
        })

        it('should throw an exception if required fields are missing', async () => {
            const doc = repository.newDocument()
            const promise = doc.save()
            await expect(promise).rejects.toThrowError()
        })

        it('should successfully update a document', async () => {
            const newDoc = repository.newDocument()
            newDoc.name = 'name1'
            await newDoc.save()

            const updateDoc = (await repository.findById(newDoc.id))!
            updateDoc.name = 'name2'
            await updateDoc!.save()

            const findDoc = await repository.findById(newDoc.id)

            expect(findDoc?.name).toEqual('name2')
        })
    })

    describe('saveMany', () => {
        it('should successfully create multiple documents', async () => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = repository.newDocument()
                doc.name = data.name
                return doc
            })

            const res = await repository.saveMany(docs)

            expect(res).toBeTruthy()
        })

        it('should throw an exception if required fields are missing', async () => {
            const docs = [repository.newDocument(), repository.newDocument()]

            const promise = repository.saveMany(docs)

            await expect(promise).rejects.toThrowError()
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('should set the pagination correctly', async () => {
            const skip = 10
            const take = 5
            const { items, ...paginated } = await repository.findWithPagination({
                pagination: { skip, take, orderby: { name: 'name', direction: OrderDirection.asc } }
            })

            sortByName(samples)
            expect(samples.slice(skip, skip + take)).toEqual(toDtos(items))
            expect(paginated).toEqual({ total: samples.length, skip, take })
        })

        it('should sort in ascending order', async () => {
            const { items } = await repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.asc }
                }
            })

            sortByName(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('should sort in descending order', async () => {
            const { items } = await repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.desc }
                }
            })

            sortByNameDescending(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('should throw an exception if ‘take’ is not positive number', async () => {
            const promise = repository.findWithPagination({ pagination: { take: -1 } })

            await expect(promise).rejects.toThrow(BadRequestException)
        })

        it('should throw an exception if ‘take’ is not specified', async () => {
            const promise = repository.findWithPagination({ pagination: {} })

            await expect(promise).rejects.toThrow(BadRequestException)
        })

        it('Should set conditions using the QueryHelper', async () => {
            const { items } = await repository.findWithPagination({
                callback: (helpers) => {
                    helpers.setQuery({ name: /Sample-00/i })
                },
                pagination: { take: 10 }
            })

            const sorted = sortByName(toDtos(items))

            expect(pickItems(sorted, 'name')).toEqual([
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
        })
    })

    describe('existByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('should return true if the IDs does exist', async () => {
            const exists = await repository.existByIds(pickIds(samples))
            expect(exists).toBeTruthy()
        })

        it('should return false if any ID does not exist', async () => {
            const exists = await repository.existByIds([nullObjectId])
            expect(exists).toBeFalsy()
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = toDto(doc)
        })

        it('should find a document by ID', async () => {
            const doc = await repository.findById(sample.id)

            expect(toDto(doc!)).toEqual(sample)
        })

        it('should return null if the ID does not exist', async () => {
            const doc = await repository.findById(nullObjectId)

            expect(doc).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('should find documents by multiple IDs', async () => {
            const ids = pickIds(samples)
            const docs = await repository.findByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        it('should ignore non-existent IDs', async () => {
            const docs = await repository.findByIds([nullObjectId])
            expect(docs).toHaveLength(0)
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = toDto(doc)
        })

        it('should find a document by ID', async () => {
            const doc = await repository.getById(sample.id)

            expect(toDto(doc)).toEqual(sample)
        })

        it('should throw an exception if the ID does not exist', async () => {
            const promise = repository.getById(nullObjectId)

            await expect(promise).rejects.toThrow(NotFoundException)
        })
    })

    describe('getByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('should find documents by multiple IDs', async () => {
            const ids = pickIds(samples)
            const docs = await repository.getByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        it('should throw an exception if any of the IDs do not exist', async () => {
            const promise = repository.getByIds([nullObjectId])

            await expect(promise).rejects.toThrow(NotFoundException)
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(repository)
            sample = toDto(doc)
        })

        it('should find a document by ID', async () => {
            await repository.deleteById(sample.id)
            const doc = await repository.findById(sample.id)

            expect(doc).toBeNull()
        })

        it('should throw an exception if the ID does not exist', async () => {
            const promise = repository.deleteById(nullObjectId)

            await expect(promise).rejects.toThrow(NotFoundException)
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(repository)
            samples = toDtos(docs)
        })

        it('should delete multiple documents successfully', async () => {
            const ids = pickIds(samples.slice(0, 10))

            const deletedCount = await repository.deleteByIds(ids)
            expect(deletedCount).toEqual(ids.length)

            const docs = await repository.findByIds(ids)

            expect(docs).toHaveLength(0)
        })

        it('should ignore non-existent IDs without errors', async () => {
            const deletedCount = await repository.deleteByIds([nullObjectId])

            expect(deletedCount).toEqual(0)
        })
    })
})
