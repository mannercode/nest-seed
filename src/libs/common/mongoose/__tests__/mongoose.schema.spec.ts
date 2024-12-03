import { expect } from '@jest/globals'
import { Type } from '@nestjs/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { HydratedDocument, Model } from 'mongoose'
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
    let model: Model<any>

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

        describe('createSchemaOptions({ json: { timestamps: true  } })', () => {
            @Schema(createSchemaOptions({ json: { timestamps: true } }))
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
            describe('createMongooseSchema({ softDeletion: true })', () => {
                @Schema(createSchemaOptions({}))
                class Sample extends MongooseSchema {
                    @Prop()
                    name: string
                }

                let doc: HydratedDocument<Sample>

                beforeEach(async () => {
                    await createModel(Sample, { softDeletion: true })

                    doc = new model()
                    doc.name = 'name'
                    await doc.save()
                })

                it('기본 옵션으로 생성된 문서는 Soft Deletion으로 동작해야 한다', async () => {
                    expect(doc).toMatchObject({ deletedAt: null })
                })

                it('삭제된 문서는 deletedAt의 값이 유효하다', async () => {
                    await model.deleteOne({ _id: doc._id })

                    const found = await model
                        .findOne({ _id: { $eq: doc._id } })
                        .setOptions({ withDeleted: true })
                        .exec()

                    expect(found.deletedAt).toEqual(expect.any(Date))
                })

                it('여러개의 문서를 삭제해도 deletedAt의 값이 유효해야 한다', async () => {
                    const doc2 = new model()
                    doc2.name = 'name'
                    await doc2.save()

                    await model.deleteMany({ _id: { $in: [doc._id, doc2._id] } as any })

                    const found = await model.find({}).setOptions({ withDeleted: true })
                    expect(found[0]).toMatchObject({ deletedAt: expect.any(Date) })
                    expect(found[1]).toMatchObject({ deletedAt: expect.any(Date) })
                })

                it('삭제된 문서는 aggregate에서 검색되지 않아야 한다', async () => {
                    await model.deleteOne({ _id: doc._id })

                    const got = await model.aggregate([{ $match: { name: 'name' } }])

                    expect(got).toHaveLength(0)
                })
            })

            describe('createMongooseSchema({ softDeletion: false })', () => {
                @Schema(createSchemaOptions({}))
                class Sample extends MongooseSchema {
                    @Prop()
                    name: string
                }

                beforeEach(async () => await createModel(Sample, { softDeletion: false }))

                it('softDeletion가 false면 생성된 문서는 deletedAt 필드가 없어야 한다', async () => {
                    const doc = new model()
                    doc.name = 'name'
                    await doc.save()

                    expect(doc).not.toHaveProperty('deletedAt')
                })
            })
        })
    })
})
