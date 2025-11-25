import { MongooseErrors, OrderDirection, pickIds, pickItems } from 'common'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import {
    createSample,
    createSamples,
    Fixture,
    SampleDto,
    sortByName,
    sortByNameDescending,
    toDto,
    toDtos
} from './mongoose.repository.fixture'

describe('MongooseRepository', () => {
    let fixture: Fixture
    let maxTake = 0

    beforeEach(async () => {
        const { createFixture, maxTakeValue } = await import('./mongoose.repository.fixture')
        fixture = await createFixture()
        maxTake = maxTakeValue
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('save', () => {
        // 새 문서를 생성하는 경우
        describe('when creating a new document', () => {
            // 성공적으로 생성한다
            it('creates the document', async () => {
                const newDoc = fixture.repository.newDocument()
                newDoc.name = 'document name'
                await newDoc.save()

                const foundDoc = await fixture.repository.findById(newDoc.id)
                expect(toDto(foundDoc!)).toEqual(toDto(newDoc))
            })
        })

        // 필수 필드가 누락된 경우
        describe('when required fields are missing', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                const doc = fixture.repository.newDocument()
                const promise = doc.save()
                await expect(promise).rejects.toThrow()
            })
        })
    })

    describe('update', () => {
        // 문서를 업데이트하는 경우
        describe('when updating a document', () => {
            // 성공적으로 업데이트한다
            it('updates the document', async () => {
                const persistedDoc = fixture.repository.newDocument()
                persistedDoc.name = 'new name'
                await persistedDoc.save()

                await fixture.repository.update(persistedDoc.id, { name: 'updated name' })

                const updatedDoc = await fixture.repository.findById(persistedDoc.id)

                expect(updatedDoc?.name).toEqual('updated name')
            })
        })
    })

    describe('saveMany', () => {
        // 여러 문서를 생성하는 경우
        describe('when creating multiple documents', () => {
            // 성공적으로 생성한다
            it('creates all documents', async () => {
                const docs = [
                    { name: 'document-1' },
                    { name: 'document-2' },
                    { name: 'document-2' }
                ].map((data) => {
                    const doc = fixture.repository.newDocument()
                    doc.name = data.name
                    return doc
                })

                const saveSucceeded = await fixture.repository.saveMany(docs)

                expect(saveSucceeded).toBe(true)
            })
        })

        // 필수 필드가 누락된 문서가 있는 경우
        describe('when any document is missing required fields', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                const docs = [fixture.repository.newDocument(), fixture.repository.newDocument()]

                const promise = fixture.repository.saveMany(docs)

                await expect(promise).rejects.toThrow()
            })
        })
    })

    describe('findWithPagination', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const { createSamples } = await import('./mongoose.repository.fixture')

            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        // 페이지네이션을 적용하는 경우
        describe('when paginating results', () => {
            // skip/take에 맞게 결과를 반환한다
            it('returns items with correct pagination', async () => {
                const skip = 10
                const take = 5
                const { items, ...pagination } = await fixture.repository.findWithPagination({
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

        // 오름차순 정렬인 경우
        describe('when sorting ascending', () => {
            // 오름차순으로 정렬한다
            it('sorts in ascending order', async () => {
                const { items } = await fixture.repository.findWithPagination({
                    pagination: {
                        take: samples.length,
                        orderby: { name: 'name', direction: OrderDirection.Asc }
                    }
                })

                sortByName(samples)
                expect(toDtos(items)).toEqual(samples)
            })
        })

        // 내림차순 정렬인 경우
        describe('when sorting descending', () => {
            // 내림차순으로 정렬한다
            it('sorts in descending order', async () => {
                const { items } = await fixture.repository.findWithPagination({
                    pagination: {
                        take: samples.length,
                        orderby: { name: 'name', direction: OrderDirection.Desc }
                    }
                })

                sortByNameDescending(samples)
                expect(toDtos(items)).toEqual(samples)
            })
        })

        // take가 0 이하인 경우
        describe('when take is not positive', () => {
            // 예외를 던진다
            it('throws an error', async () => {
                const promise = fixture.repository.findWithPagination({ pagination: { take: -1 } })

                await expect(promise).rejects.toThrow(fixture.BadRequestException)
            })
        })

        // take가 제한을 초과한 경우
        describe('when take exceeds the limit', () => {
            // BadRequest를 던진다
            it('throws a BadRequest', async () => {
                const take = maxTake + 1

                const promise = fixture.repository.findWithPagination({ pagination: { take } })

                await expect(promise).rejects.toThrow(fixture.BadRequestException)
            })
        })

        // take가 지정되지 않은 경우
        describe('when take is not specified', () => {
            // 기본값을 사용한다
            it('uses the default take value', async () => {
                const { take } = await fixture.repository.findWithPagination({
                    pagination: { orderby: { name: 'name', direction: OrderDirection.Desc } }
                })

                expect(take).toEqual(maxTake)
            })
        })

        // QueryHelper를 사용하는 경우
        describe('when QueryHelper configures conditions', () => {
            // 조건을 적용해 결과를 반환한다
            it('applies the configured conditions', async () => {
                const { items } = await fixture.repository.findWithPagination({
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
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        // 모든 ID가 존재하는 경우
        describe('when all ids exist', () => {
            // true를 반환한다
            it('returns true', async () => {
                const exists = await fixture.repository.allExistByIds(pickIds(samples))
                expect(exists).toBe(true)
            })
        })

        // 존재하지 않는 ID가 있는 경우
        describe('when any id does not exist', () => {
            // false를 반환한다
            it('returns false', async () => {
                const exists = await fixture.repository.allExistByIds([nullObjectId])
                expect(exists).toBe(false)
            })
        })
    })

    describe('findById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fixture.repository)
            sample = toDto(doc)
        })

        // ID가 존재하는 경우
        describe('when the id exists', () => {
            // 문서를 반환한다
            it('returns the document', async () => {
                const doc = await fixture.repository.findById(sample.id)

                expect(toDto(doc!)).toEqual(sample)
            })
        })

        // ID가 존재하지 않는 경우
        describe('when the id does not exist', () => {
            // null을 반환한다
            it('returns null', async () => {
                const doc = await fixture.repository.findById(nullObjectId)

                expect(doc).toBeNull()
            })
        })
    })

    describe('findByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        // 모든 ID가 존재하는 경우
        describe('when the ids exist', () => {
            // 문서들을 반환한다
            it('returns the documents', async () => {
                const ids = pickIds(samples)
                const docs = await fixture.repository.findByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        // 존재하지 않는 ID가 포함된 경우
        describe('when ids include missing documents', () => {
            // 존재하지 않는 ID는 무시한다
            it('ignores missing ids', async () => {
                const docs = await fixture.repository.findByIds([nullObjectId])
                expect(docs).toHaveLength(0)
            })
        })
    })

    describe('getById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fixture.repository)
            sample = toDto(doc)
        })

        // ID가 존재하는 경우
        describe('when the id exists', () => {
            // 문서를 반환한다
            it('returns the document', async () => {
                const doc = await fixture.repository.getById(sample.id)

                expect(toDto(doc)).toEqual(sample)
            })
        })

        // ID가 존재하지 않는 경우
        describe('when the id does not exist', () => {
            // 예외를 던진다
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.getById(nullObjectId)

                await expect(promise).rejects.toThrow(fixture.NotFoundException)
            })
        })
    })

    describe('getByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        // 모든 ID가 존재하는 경우
        describe('when all ids exist', () => {
            // 문서들을 반환한다
            it('returns the documents', async () => {
                const ids = pickIds(samples)
                const docs = await fixture.repository.getByIds(ids)

                expectEqualUnsorted(toDtos(docs), samples)
            })
        })

        // 존재하지 않는 ID가 있는 경우
        describe('when any id is missing', () => {
            // 예외를 던진다
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.getByIds([nullObjectId])

                await expect(promise).rejects.toThrow(fixture.NotFoundException)
            })
        })
    })

    describe('deleteById', () => {
        let sample: SampleDto

        beforeEach(async () => {
            const doc = await createSample(fixture.repository)
            sample = toDto(doc)
        })

        // ID가 존재하는 경우
        describe('when the id exists', () => {
            // 문서를 삭제한다
            it('deletes the document', async () => {
                await fixture.repository.deleteById(sample.id)
                const doc = await fixture.repository.findById(sample.id)

                expect(doc).toBeNull()
            })
        })

        // ID가 존재하지 않는 경우
        describe('when the id does not exist', () => {
            // 예외를 던진다
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.deleteById(nullObjectId)

                await expect(promise).rejects.toThrow(fixture.NotFoundException)
            })
        })
    })

    describe('deleteByIds', () => {
        let samples: SampleDto[]

        beforeEach(async () => {
            const docs = await createSamples(fixture.repository)
            samples = toDtos(docs)
        })

        // 모든 ID가 존재하는 경우
        describe('when all ids exist', () => {
            // 문서를 삭제한다
            it('deletes the documents', async () => {
                const samplesToDelete = samples.slice(5, 10)
                const ids = pickIds(samplesToDelete)

                const deletedDocs = await fixture.repository.deleteByIds(ids)
                expect(toDtos(deletedDocs)).toEqual(samplesToDelete)

                const docs = await fixture.repository.findByIds(ids)
                expect(docs).toHaveLength(0)
            })
        })

        // 존재하지 않는 ID가 있는 경우
        describe('when any id is missing', () => {
            // 예외를 던진다
            it('throws NotFoundException', async () => {
                const promise = fixture.repository.deleteByIds([nullObjectId])

                const error = await promise.catch((e) => e)

                expect(error).toBeInstanceOf(fixture.NotFoundException)
                expect(error.response).toEqual({
                    ...MongooseErrors.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })
})
