import { z } from 'zod'

const coordinate = z.union([z.number(), z.string(), z.boolean()]).transform(Number)

export const TheaterLocationSchema = z.strictObject({
    latitude: coordinate.pipe(z.number().min(-90).max(90)),
    longitude: coordinate.pipe(z.number().min(-180).max(180))
})

export class TheaterLocation {
    latitude: number

    longitude: number
}
