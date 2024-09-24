import { expect } from '@jest/globals'
import { newObjectId, objectId, ObjectId, objectIds } from 'common'
import { Types } from 'mongoose'

describe('MongooseRepository Utils', () => {
    it('newObjectId', async () => {
        const objectId = newObjectId()
        expect(Types.ObjectId.isValid(objectId)).toBeTruthy()
    })

    describe('objectId', () => {
        it('should convert a string to an ObjectId', () => {
            const idString = '507f1f77bcf86cd799439011'
            const result = objectId(idString)

            expect(result).toBeInstanceOf(ObjectId)
            expect(result.toString()).toBe(idString)
        })

        it('should throw an error for invalid ObjectId strings', () => {
            const invalidId = 'invalid-id'

            expect(() => objectId(invalidId)).toThrow()
        })
    })

    describe('objectIds', () => {
        it('should convert an array of strings to an array of ObjectIds', () => {
            const idStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            const result = objectIds(idStrings)

            expect(result).toHaveLength(2)
            result.forEach((id, index) => {
                expect(id).toBeInstanceOf(ObjectId)
                expect(id.toString()).toBe(idStrings[index])
            })
        })

        it('should return an empty array when given an empty array', () => {
            const result = objectIds([])

            expect(result).toEqual([])
        })

        it('should throw an error if any string in the array is invalid', () => {
            const idStrings = ['507f1f77bcf86cd799439011', 'invalid-id']

            expect(() => objectIds(idStrings)).toThrow()
        })
    })
})
