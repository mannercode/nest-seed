import { z } from 'zod'
import { DateUtil } from './date.js'

const instantInput = z.union([z.instanceof(Temporal.Instant), z.date(), z.string()])

const plainDateInput = z.union([z.instanceof(Temporal.PlainDate), z.date(), z.string()])

export const InstantFromInputSchema = instantInput.transform((value, context) => {
    try {
        return DateUtil.instantFromInput(value)
    } catch {
        context.addIssue({ code: 'custom', message: 'Expected an ISO 8601 UTC instant' })
        return z.NEVER
    }
})

export const PlainDateFromInputSchema = plainDateInput.transform((value, context) => {
    try {
        return DateUtil.plainDateFromInput(value)
    } catch {
        context.addIssue({ code: 'custom', message: 'Expected a valid calendar date' })
        return z.NEVER
    }
})
