import type { z } from 'zod'

type Transform<Input, Output> = (value: Exclude<Input, undefined>) => Output

type FieldAssignment<Target, Source, Key extends keyof Source & keyof Target> = {
    [K in Key]-?: [Exclude<Source[K], undefined>] extends [Target[K]]
        ? [key: K, transform?: Transform<Source[K], Target[K]>]
        : [key: K, transform: Transform<Source[K], Target[K]>]
}[Key]

export function assignIfDefined<
    Target extends Record<string, any>,
    Source extends Record<string, any>,
    K extends keyof Source & keyof Target
>(target: Target, source: Source, ...[key, transform]: FieldAssignment<Target, Source, K>): void {
    const value = source[key]
    if (value === undefined) return
    target[key] = transform ? transform(value) : value
}

/** DTO 스키마에 선언한 필드만 선택하고 변환한다. */
export function mapDocToDto<Shape extends z.ZodRawShape>(doc: object, schema: z.ZodObject<Shape>) {
    return schema.strip().parse(doc)
}
