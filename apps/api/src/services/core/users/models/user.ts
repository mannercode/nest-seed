import { CrudDocument } from '@mannercode/common'

export class User extends CrudDocument {
    authVersion: number

    birthDate: Date

    email: string

    name: string

    password: string
}
