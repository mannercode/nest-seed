import { MongooseErrors, OrderDirection, pickIds, pickItems } from 'common'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import {
    createSample,
    createSamples,
    MongooseRepositoryFixture,
    SampleDto,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos
} from './mongoose.repository.fixture'

describe('MongooseRepository', () => {
    let fix: MongooseRepositoryFixture
    let maxTake = 0

    beforeEach(async () => {
        const { createMongooseRepositoryFixture, maxTakeValue } =
            await import('./mongoose.repository.fixture')
        fix = await createMongooseRepositoryFixture()
        maxTake = maxTakeValue
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('save', () => {
        describe('when creating a new document', () => {
            it('creates the document', async () => {
                const newDoc = fix.repository.newDocument()
                newDoc.name = 'document name'
                await newDoc.save()

                const foundDoc = await fix.repository.findById(newDoc.id)
                expect(toDto(foundDoc!)).toEqual(toDto(newDoc))
            })
        })

        describe('when the required fields are missing', () => {
            it('throws an error', async () => {
                const doc = fix.repository.newDocument()
                const promise = doc.save()
                await expect(promise).rejects.toThrow()
            })
        })
    })

    describe('update', () => {
        it('updates the document', async () => {
            const persistedDoc = fix.repository.newDocument()
            persistedDoc.name = 'new name'
            await persistedDoc.save()

            await fix.repository.update(persistedDoc.id, { name: 'updated name' })

            const updatedDoc = await fix.repository.findById(persistedDoc.id)

            expect(updatedDoc?.name).toEqual('updated name')
        })
    })

    describe('saveMany', () => {
        describe('when creating multiple documents', () => {
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
        })

        describe('when any document is missing required fields', () => {
            it('throws an error', async () => {
                const docs = [fix.repository.newDocument(), fix.repository.newDocument()]

                const promise = fix.repository.saveMany(docs)

                await expect(promise).rejects.toThrow()
            })
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const { createSamples } = await import('./mongoose.repository.fixture')

            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('when paginating results', () => {
            it('returns items with correct pagination', async () => {
                const skip = 10
                const take = 5
                const { items, ...pagination } = await fix.repository.findWithPagination({
                    pagination: {
                        skip,
                        take,
                        orderby: { name: 'name', direction: OrderDirection.Asc }
                    }
                })

                sortByName(samples)
                expect(samples.slice(skip, skip + take)).toEqual(toDtos(items))
                expect(pagination).toEqual({ total: samples.length, skip, take })
            })
        })

        describe('when sorting in ascending order', () => {
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
        })

        describe('when sorting in descending order', () => {
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
        })

        describe('when the take value is not positive', () => {
            it('throws an error', async () => {
                const promise = fix.repository.findWithPagination({ pagination: { take: -1 } })

                await expect(promise).rejects.toThrow(fix.BadRequestException)
            })
        })

        describe('when the take value exceeds the limit', () => {
            it('throws a BadRequest', async () => {
                const take = maxTake + 1

                const promise = fix.repository.findWithPagination({ pagination: { take } })

                await expect(promise).rejects.toThrow(fix.BadRequestException)
            })
        })

        describe('when the take value is not specified', () => {
            it('uses the default take value', async () => {
                const { take } = await fix.repository.findWithPagination({
                    pagination: { orderby: { name: 'name', direction: OrderDirection.Desc } }
                })

                expect(take).toEqual(maxTake)
            })
        })

        describe('when the QueryHelper configures conditions', () => {
            it('applies the configured conditions', async () => {
                const { items } = await fix.repository.findWithPagination({
                    configureQuery: (queryHelper) => {
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
    })

    describe('allExistByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('when all ids exist', () => {
            it('returns true', async () => {
                const exists = await fix.repository.allExistByIds(pickIds(samples))
                expect(exists).toBe(true)
            })
        })

        describe('when any id does not exist', () => {
            it('returns false', async () => {
                const exists = await fix.repository.allExistByIds([nullObjectId])
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

        describe('when the id exists', () => {
            it('returns the document', async () => {
                const doc = await fix.repository.findById(sample.id)

                expect(toDto(doc!)).toEqual(sample)
            })
        })

        describe('when the id does not exist', () => {
            it('returns null', async () => {
                const doc = await fix.repository.findById(nullObjectId)

                expect(doc).toBeNull()
            })
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fix.repository)
            samples = toDtos(docs)
        })

        describe('when the ids exist', () => {
            it('returns the documents', async () => {
                const ids = pickIds(samples)
                const docs = await fix.repository.findByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        describe('when the ids include missing documents', () => {
            it('ignores missing ids', async () => {
                const docs = await fix.repository.findByIds([nullObjectId])
                expect(docs).toHaveLength(0)
            })
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fix.repository)
            sample = toDto(doc)
        })

        describe('when the id exists', () => {
            it('returns the document', async () => {
                const doc = await fix.repository.getById(sample.id)

                expect(toDto(doc)).toEqual(sample)
            })
        })

        describe('when the id does not exist', () => {
            it('throws NotFoundException', async () => {
                const promise = fix.repository.getById(nullObjectId)

                await expect(promise).rejects.toThrow(fix.NotFoundException)
            })
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

        describe('when the id exists', () => {
            it('deletes the document', async () => {
                await fix.repository.deleteById(sample.id)
                const doc = await fix.repository.findById(sample.id)

                expect(doc).toBeNull()
            })
        })

        describe('when the id does not exist', () => {
            it('throws NotFoundException', async () => {
                const promise = fix.repository.deleteById(nullObjectId)

                await expect(promise).rejects.toThrow(fix.NotFoundException)
            })
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
