import { CrudDocument } from '@mannercode/common'

export class Admin extends CrudDocument {
    authVersion: number

    email: string

    name: string

    password: string
}
