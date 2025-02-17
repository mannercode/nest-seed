type Paths<T, ParentPath extends string = ''> = {
    [K in keyof T]: T[K] extends object
        ? Paths<T[K], `${ParentPath}${K & string}.`>
        : `${ParentPath}${K & string}`
}

export function createRoutes<T extends Record<string, any>>(
    obj: T,
    parentPath: string = ''
): Paths<T> {
    const result: any = {}
    for (const key in obj) {
        const currentPath = parentPath ? `${parentPath}.${key}` : key
        const value = obj[key]

        if (typeof value === 'object' && value !== null) {
            result[key] = createRoutes(value, currentPath)
        } else {
            result[key] = currentPath
        }
    }
    return result as Paths<T>
}
