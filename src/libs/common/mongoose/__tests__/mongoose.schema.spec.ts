import { expect } from '@jest/globals'
import { Type } from '@nestjs/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { SoftDeleteModel } from 'mongoose-delete'
import { HttpTestContext } from 'testlib'
import {
    createMongooseSchema,
    createSchemaOptions,
    MongooseSchema,
    MongooseSchemaOptions
} from '../mongoose.schema'
import { createFixture } from './mongoose.schema.fixture'

describe('MongooseSchema', () => {
    let testContext: HttpTestContext
    let model: SoftDeleteModel<any>

    const createModel = async <T>(cls: Type<T>, options: MongooseSchemaOptions) => {
        const SampleSchema = createMongooseSchema(cls, options)
        const fixture = await createFixture(SampleSchema)
        testContext = fixture.testContext
        model = fixture.model
    }

    afterEach(async () => await testContext?.close())

    describe('createSchemaOptions()', () => {
        describe('createSchemaOptions({})', () => {
            @Schema(createSchemaOptions({}))
            class Sample extends MongooseSchema {
                @Prop()
                name: string
            }

            let doc: HydratedDocument<Sample>

            beforeEach(async () => {
                await createModel(Sample, {})

                doc = new model()
                doc.name = 'name'
                await doc.save()
            })

            it('기본 옵션으로 생성된 문서는 timestamp 필드를 포함한다', async () => {
                expect(doc).toMatchObject({
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                })
            })

            it('기본 옵션으로 생성된 문서의 JSON 객체는 timestamp 필드를 포함하지 않는다', async () => {
                const json = doc.toJSON()
                expect(json).not.toHaveProperty('createdAt')
                expect(json).not.toHaveProperty('updatedAt')
            })
        })

        describe('createSchemaOptions({ json: { omits } })', () => {
            @Schema(createSchemaOptions({ json: { omits: ['password'] } }))
            class Sample extends MongooseSchema {
                @Prop()
                name: string
                @Prop()
                password: string
            }

            beforeEach(async () => await createModel(Sample, {}))

            it('should omit the password field when converting to JSON', async () => {
                const doc = new model()
                doc.name = 'name'
                doc.password = 'password'
                await doc.save()

                const json = doc.toJSON()
                expect(json.password).toBeUndefined()
            })
        })

        describe('createSchemaOptions({ json: { includes: { timestamps: true } } })', () => {
            @Schema(createSchemaOptions({ json: { includes: { timestamps: true } } }))
            class Sample extends MongooseSchema {
                @Prop()
                name: string
            }

            beforeEach(async () => await createModel(Sample, {}))

            it('should include the timestamp fields when converting to JSON', async () => {
                const doc = new model()
                doc.name = 'name'
                await doc.save()

                const json = doc.toJSON()

                expect(json).toMatchObject({
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                })
            })
        })

        describe('createSchemaOptions({ timestamps: false })', () => {
            @Schema(createSchemaOptions({ timestamps: false }))
            class Sample extends MongooseSchema {
                @Prop()
                name: string
            }

            beforeEach(async () => await createModel(Sample, {}))

            it('timestamps가 false면 생성된 문서는 timestampe 필드가 없어야 한다', async () => {
                const doc = new model()
                doc.name = 'name'
                await doc.save()

                expect(doc).not.toHaveProperty('createdAt')
                expect(doc).not.toHaveProperty('updatedAt')
            })
        })

        describe('createMongooseSchema', () => {
            describe('createMongooseSchema({})', () => {
                @Schema(createSchemaOptions({}))
                class Sample extends MongooseSchema {
                    @Prop()
                    name: string
                }

                let doc: HydratedDocument<Sample>

                beforeEach(async () => {
                    await createModel(Sample, {})

                    doc = new model()
                    doc.name = 'name'
                    await doc.save()
                })

                it('기본 옵션으로 생성된 문서는 softDeletion 필드를 포함한다', async () => {
                    expect(doc).toMatchObject({ deleted: false })
                })

                it('삭제된 문서는 deletedAt 필드를 포함한다', async () => {
                    await model.deleteById(doc.id)

                    const found = await model.findOneDeleted({ _id: { $eq: doc._id } })

                    expect(found).toMatchObject({ deleted: true, deletedAt: expect.any(Date) })
                })

                it('여러개의 문서를 삭제해도 deletedAt 필드를 포함해야 한다', async () => {
                    const doc2 = new model()
                    doc2.name = 'name'
                    await doc2.save()

                    await model.delete({ _id: { $in: [doc._id, doc2._id] } as any })

                    const found = await model.findDeleted({})
                    expect(found[0]).toMatchObject({ deleted: true, deletedAt: expect.any(Date) })
                    expect(found[1]).toMatchObject({ deleted: true, deletedAt: expect.any(Date) })
                })
            })

            describe('createMongooseSchema({ softDeletion: false })', () => {
                @Schema(createSchemaOptions({}))
                class Sample extends MongooseSchema {
                    @Prop()
                    name: string
                }

                beforeEach(async () => await createModel(Sample, { softDeletion: false }))

                it('softDeletion가 false면 생성된 문서는 deleted 필드가 없어야 한다', async () => {
                    const doc = new model()
                    doc.name = 'name'
                    await doc.save()

                    expect(doc).not.toHaveProperty('deleted')
                })
            })
        })
    })
})
