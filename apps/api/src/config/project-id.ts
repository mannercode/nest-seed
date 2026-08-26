import { Require } from '@mannercode/common'

export const PROJECT_ID_TOKEN = Symbol('PROJECT_ID')

export function readProjectId(): string {
    Require.defined(process.env.PROJECT_ID, 'PROJECT_ID must be defined.')
    return process.env.PROJECT_ID
}
