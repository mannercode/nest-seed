import { CrudDocument } from '@mannercode/common'

export class User extends CrudDocument {
    birthDate: Temporal.PlainDate

    email: string

    name: string

    password: string
}
