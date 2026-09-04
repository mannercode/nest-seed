import { Env } from '@mannercode/common'

export const PROJECT_ID_TOKEN = Symbol('PROJECT_ID')

export function readProjectId(): string {
    return Env.getString('PROJECT_ID')
}
