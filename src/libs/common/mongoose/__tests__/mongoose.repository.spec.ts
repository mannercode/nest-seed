import { MongooseErrors, OrderDirection, pickIds, pickItems } from 'common'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import {
    createSample,
    createSamples,
    maxTakeValue,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos
} from './mongoose.repository.fixture'
import type { MongooseRepositoryFixture, SampleDto } from './mongoose.repository.fixture'

describe('MongooseRepository', () => {
    let fix: MongooseRepositoryFixture

    beforeEach(async () => {
        const { createMongooseRepositoryFixture } = await import('./mongoose.repository.fixture')
        fix = await createMongooseRepositoryFixture()
    })
    afterEach(() => fix.teardown())

    describe('save', () => {
        it('creates the document', async () => {
            const newDoc = fix.repository.newDocument()
            newDoc.name = 'document name'
            await newDoc.save()

            const foundDoc = await fix.repository.findById(newDoc.id)
            expect(toDto(foundDoc)).toEqual(toDto(newDoc))
        })

        it('throws for missing required fields', async () => {
            const doc = fix.repository.newDocument()
            const promise = doc.save()
            await expect(promise).rejects.toThrow()
        })
    })

    describe('saveMany', () => {
        it('creates all documents', async () => {
            const docs = [
                { name: 'document-1' },
                { name: 'document-2' },
                { name: 'document-2' }
            ].map((data) => {
                const doc = fix.repository.newDocument()
                doc.name = data.name
                return doc
            })

            const saveSucceeded = await fix.repository.saveMany(docs)

            expect(saveSucceeded).toBe(true)
        })

        it('throws for missing required fields', async () => {
            const docs = [fix.repository.newDocument(), fix.repository.newDocument()]

            const promise = fix.repository.saveMany(docs)

            await expect(promise).rejects.toThrow()
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        it('returns items with correct pagination', async () => {
            const skip = 10
            const take = 5
            const { items, ...pagination } = await fix.repository.findWithPagination({
                pagination: { skip, take, orderby: { name: 'name', direction: OrderDirection.Asc } }
            })

            sortByName(samples)
            expect(samples.slice(skip, skip + take)).toEqual(toDtos(items))
            expect(pagination).toEqual({ total: samples.length, skip, take })
        })

        it('sorts in ascending order', async () => {
            const { items } = await fix.repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.Asc }
                }
            })

            sortByName(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('sorts in descending order', async () => {
            const { items } = await fix.repository.findWithPagination({
                pagination: {
                    take: samples.length,
                    orderby: { name: 'name', direction: OrderDirection.Desc }
                }
            })

            sortByNameDescending(samples)
            expect(toDtos(items)).toEqual(samples)
        })

        it('throws for a non-positive take value', async () => {
            const promise = fix.repository.findWithPagination({ pagination: { take: -1 } })

            await expect(promise).rejects.toThrow(fix.BadRequestException)
        })

        it('throws BadRequestException for take above the limit', async () => {
            const take = maxTakeValue + 1

            const promise = fix.repository.findWithPagination({ pagination: { take } })

            await expect(promise).rejects.toThrow(fix.BadRequestException)
        })

        describe('when take is not provided', () => {
            it('uses the default take value', async () => {
                const { take } = await fix.repository.findWithPagination({
                    pagination: { orderby: { name: 'name', direction: OrderDirection.Desc } }
                })

                expect(take).toEqual(maxTakeValue)
            })
        })

        it('applies configured conditions', async () => {
            const { items } = await fix.repository.findWithPagination({
                configureQuery: async (queryHelper) => {
                    queryHelper.setQuery({ name: /Sample-00/i })
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

    describe('allExist', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('returns true', async () => {
                const exists = await fix.repository.allExist(pickIds(samples))
                expect(exists).toBe(true)
            })
        })

        describe('when any id is missing', () => {
            it('returns false', async () => {
                const exists = await fix.repository.allExist([nullObjectId])
                expect(exists).toBe(false)
            })
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        it('returns the document for an existing id', async () => {
            const doc = await fix.repository.findById(sample.id)

            expect(toDto(doc)).toEqual(sample)
        })

        it('returns null for a missing id', async () => {
            const doc = await fix.repository.findById(nullObjectId)

            expect(doc).toBeNull()
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        it('returns the documents for existing ids', async () => {
            const ids = pickIds(samples)
            const docs = await fix.repository.findByIds(ids)

            expectEqualUnsorted(toDtos(docs), samples)
        })

        it('ignores missing ids', async () => {
            const docs = await fix.repository.findByIds([nullObjectId])
            expect(docs).toHaveLength(0)
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        it('returns the document for an existing id', async () => {
            const doc = await fix.repository.getById(sample.id)

            expect(toDto(doc)).toEqual(sample)
        })

        it('throws NotFoundException for a missing id', async () => {
            const promise = fix.repository.getById(nullObjectId)

            await expect(promise).rejects.toThrow(fix.NotFoundException)
        })
    })

    describe('getByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('returns the documents', async () => {
                const ids = pickIds(samples)
                const docs = await fix.repository.getByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        describe('when any id is missing', () => {
            it('throws NotFoundException', async () => {
                const promise = fix.repository.getByIds([nullObjectId])

                await expect(promise).rejects.toThrow(fix.NotFoundException)
            })
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        it('deletes the document for an existing id', async () => {
            await fix.repository.deleteById(sample.id)
            const doc = await fix.repository.findById(sample.id)

            expect(doc).toBeNull()
        })

        it('throws NotFoundException for a missing id', async () => {
            const promise = fix.repository.deleteById(nullObjectId)

            await expect(promise).rejects.toThrow(fix.NotFoundException)
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('deletes the documents', async () => {
                const samplesToDelete = samples.slice(5, 10)
                const ids = pickIds(samplesToDelete)

                const deletedDocs = await fix.repository.deleteByIds(ids)
                expect(toDtos(deletedDocs)).toEqual(samplesToDelete)

                const docs = await fix.repository.findByIds(ids)
                expect(docs).toHaveLength(0)
            })
        })

        describe('when any id is missing', () => {
            it('throws NotFoundException', async () => {
                const promise = fix.repository.deleteByIds([nullObjectId])

                const error = await promise.catch((e) => e)

                expect(error).toBeInstanceOf(fix.NotFoundException)
                expect(error.response).toEqual({
                    ...MongooseErrors.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })
})
