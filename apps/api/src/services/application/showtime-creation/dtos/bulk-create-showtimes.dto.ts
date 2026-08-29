import { z } from 'zod'

const dateFromInput = z.union([z.date(), z.string(), z.number(), z.boolean()]).pipe(z.coerce.date())
const positiveNumber = z
    .union([z.number(), z.string(), z.boolean()])
    .transform(Number)
    .pipe(z.number().positive())
const requiredString = z
    .union([z.string(), z.number(), z.boolean()])
    .transform(String)
    .pipe(z.string().min(1))

export const BulkCreateShowtimesSchema = z.strictObject({
    durationInMinutes: positiveNumber,
    movieId: requiredString,
    startTimes: z.array(dateFromInput).min(1).max(20),
    theaterIds: z
        .array(z.string())
        .min(1)
        .max(20)
        .refine((ids) => new Set(ids).size === ids.length, 'Duplicate theater IDs are not allowed')
})

export type BulkCreateShowtimesDto = z.infer<typeof BulkCreateShowtimesSchema>
