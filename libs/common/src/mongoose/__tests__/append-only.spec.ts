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
        describe('새 문서를 insert 한다', () => {
            it('정상적으로 저장된다', () => {
                expect(createdDoc.id).toBeDefined()
                expect(createdDoc.name).toBe('name')
            })
        })

        describe('기존 문서에 save() 를 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                createdDoc.name = 'changed'
                await expect(createdDoc.save()).rejects.toThrow(/append-only/)
            })
        })

        describe('model.updateOne 을 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                await expect(
                    fix.model.updateOne({ _id: createdDoc._id }, { name: 'changed' }).exec()
                ).rejects.toThrow(/append-only/)
            })
        })

        describe('model.updateMany 를 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                await expect(fix.model.updateMany({}, { name: 'changed' }).exec()).rejects.toThrow(
                    /append-only/
                )
            })
        })

        describe('model.findOneAndUpdate 를 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                await expect(
                    fix.model.findOneAndUpdate({ _id: createdDoc._id }, { name: 'changed' }).exec()
                ).rejects.toThrow(/append-only/)
            })
        })

        describe('model.deleteOne 을 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                await expect(fix.model.deleteOne({ _id: createdDoc._id }).exec()).rejects.toThrow(
                    /append-only/
                )
            })
        })

        describe('model.deleteMany 를 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                await expect(fix.model.deleteMany({}).exec()).rejects.toThrow(/append-only/)
            })
        })

        describe('document.deleteOne() 을 호출할 때', () => {
            it('append-only error 를 던진다', async () => {
                await expect(createdDoc.deleteOne()).rejects.toThrow(/append-only/)
            })
        })

        describe('findById 로 조회할 때', () => {
            it('문서를 정상적으로 반환한다', async () => {
                const found = await fix.model.findById(createdDoc._id).lean({ virtuals: true })
                expect(found).toMatchObject({ name: 'name' })
            })
        })
    })

    describe('AppendOnlyRepository', () => {
        describe('newDocument', () => {
            it('새 hydrated document 를 반환한다', () => {
                const doc = fix.repository.newDocument()
                expect(doc.isNew).toBe(true)
            })
        })

        describe('subclass append', () => {
            it('도메인 메서드가 정상적으로 insert 한다', async () => {
                const dto = await fix.repository.append('via-append')
                const found = await fix.model.findById(dto.id).lean({ virtuals: true })
                expect(found).toMatchObject({ name: 'via-append' })
            })
        })
    })
})
