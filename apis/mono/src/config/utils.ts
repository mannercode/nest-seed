import { Require } from '@mannercode/common'

export function getProjectId() {
    Require.defined(process.env.PROJECT_ID, 'PROJECT_ID must be defined.')

    return process.env.PROJECT_ID
}
