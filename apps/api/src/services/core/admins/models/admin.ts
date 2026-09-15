import { CrudDocument } from '@mannercode/common'

export class Admin extends CrudDocument {
    email: string

    name: string

    password: string
}
