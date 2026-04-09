import type { HydratedDocument } from 'mongoose'
import type { AppendOnlyFixture, AppendOnlySample } from './append-only.fixture'

describe('AppendOnly', () => {
    let fix: AppendOnlyFixture
    let createdDoc: HydratedDocument<AppendOnlySample>

    beforeEach(async () => {
        const { createAppendOnlyFixture } = await import('./append-only.fixture')
        fix = await createAppendOnlyFixture()

        createdDoc = fix.repository.newDocument()
        createdDoc.name = 'name'
        await createdDoc.save()
    })
    afterEach(() => fix.teardown())

    describe('AppendOnlySchema', () => {
        // 새 문서를 insert 한다
        describe('when inserting a new document', () => {
            // 정상적으로 저장된다
            it('saves the document', () => {
                expect(createdDoc.id).toBeDefined()
                expect(createdDoc.name).toBe('name')
            })
        })

        // 기존 문서에 save() 를 호출할 때
        describe('when calling save() on an existing document', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                createdDoc.name = 'changed'
                await expect(createdDoc.save()).rejects.toThrow(/append-only/)
            })
        })

        // model.updateOne 을 호출할 때
        describe('when calling model.updateOne', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                await expect(
                    fix.model.updateOne({ _id: createdDoc._id }, { name: 'changed' }).exec()
                ).rejects.toThrow(/append-only/)
            })
        })

        // model.updateMany 를 호출할 때
        describe('when calling model.updateMany', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                await expect(fix.model.updateMany({}, { name: 'changed' }).exec()).rejects.toThrow(
                    /append-only/
                )
            })
        })

        // model.findOneAndUpdate 를 호출할 때
        describe('when calling model.findOneAndUpdate', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                await expect(
                    fix.model.findOneAndUpdate({ _id: createdDoc._id }, { name: 'changed' }).exec()
                ).rejects.toThrow(/append-only/)
            })
        })

        // model.deleteOne 을 호출할 때
        describe('when calling model.deleteOne (query)', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                await expect(fix.model.deleteOne({ _id: createdDoc._id }).exec()).rejects.toThrow(
                    /append-only/
                )
            })
        })

        // model.deleteMany 를 호출할 때
        describe('when calling model.deleteMany', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                await expect(fix.model.deleteMany({}).exec()).rejects.toThrow(/append-only/)
            })
        })

        // document.deleteOne() 을 호출할 때
        describe('when calling document.deleteOne()', () => {
            // append-only error 를 던진다
            it('throws an append-only error', async () => {
                await expect(createdDoc.deleteOne()).rejects.toThrow(/append-only/)
            })
        })

        // findById 로 조회할 때
        describe('when calling findById', () => {
            // 문서를 정상적으로 반환한다
            it('returns the document', async () => {
                const found = await fix.model.findById(createdDoc._id).lean({ virtuals: true })
                expect(found).toMatchObject({ name: 'name' })
            })
        })
    })

    describe('AppendOnlyRepository', () => {
        // newDocument 가 hydrated document 를 반환한다
        describe('newDocument', () => {
            // 새 hydrated document 를 반환한다
            it('returns a fresh hydrated document', () => {
                const doc = fix.repository.newDocument()
                expect(doc.isNew).toBe(true)
            })
        })

        // subclass 의 append 가 정상적으로 insert 한다
        describe('subclass append', () => {
            // 도메인 메서드가 정상적으로 insert 한다
            it('inserts via subclass append method', async () => {
                const dto = await fix.repository.append('via-append')
                const found = await fix.model.findById(dto.id).lean({ virtuals: true })
                expect(found).toMatchObject({ name: 'via-append' })
            })
        })
    })
})
