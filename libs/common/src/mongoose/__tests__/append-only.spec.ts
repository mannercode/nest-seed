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
        it('새 문서를 저장한다', () => {
            expect(createdDoc.id).toBeDefined()
            expect(createdDoc.name).toBe('name')
        })

        it('기존 문서에 save()를 호출하면 append-only 예외를 던진다', async () => {
            createdDoc.name = 'changed'
            await expect(createdDoc.save()).rejects.toThrow(/append-only/)
        })

        it('findById로 문서를 조회할 수 있다', async () => {
            const found = await fix.model.findById(createdDoc._id).lean()
            expect(found).toMatchObject({ name: 'name' })
        })

        describe('변경/삭제 메서드를 호출하면', () => {
            it('updateOne은 예외를 던진다', async () => {
                await expect(
                    fix.model.updateOne({ _id: createdDoc._id }, { name: 'changed' }).exec()
                ).rejects.toThrow(/append-only/)
            })

            it('updateMany는 예외를 던진다', async () => {
                await expect(fix.model.updateMany({}, { name: 'changed' }).exec()).rejects.toThrow(
                    /append-only/
                )
            })

            it('findOneAndUpdate는 예외를 던진다', async () => {
                await expect(
                    fix.model.findOneAndUpdate({ _id: createdDoc._id }, { name: 'changed' }).exec()
                ).rejects.toThrow(/append-only/)
            })

            it('deleteOne은 예외를 던진다', async () => {
                await expect(fix.model.deleteOne({ _id: createdDoc._id }).exec()).rejects.toThrow(
                    /append-only/
                )
            })

            it('deleteMany는 예외를 던진다', async () => {
                await expect(fix.model.deleteMany({}).exec()).rejects.toThrow(/append-only/)
            })

            it('document.deleteOne()도 예외를 던진다', async () => {
                await expect(createdDoc.deleteOne()).rejects.toThrow(/append-only/)
            })

            it('replaceOne도 예외를 던진다', async () => {
                await expect(
                    fix.model.replaceOne({ _id: createdDoc._id }, { name: 'replaced' }).exec()
                ).rejects.toThrow(/append-only/)
            })

            it('findOneAndDelete도 예외를 던진다', async () => {
                await expect(
                    fix.model.findOneAndDelete({ _id: createdDoc._id }).exec()
                ).rejects.toThrow(/append-only/)
            })

            it('bulkWrite도 예외를 던진다', async () => {
                await expect(
                    fix.model.bulkWrite([{ deleteOne: { filter: { _id: createdDoc._id } } }])
                ).rejects.toThrow(/append-only/)
            })
        })
    })

    describe('AppendOnlyRepository', () => {
        it('append() 도메인 메서드로 새 문서를 저장한다', async () => {
            const dto = await fix.repository.append('via-append')
            const found = await fix.model.findById(dto.id).lean()
            expect(found).toMatchObject({ name: 'via-append' })
        })
    })
})
