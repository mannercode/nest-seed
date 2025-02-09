import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config({ path: ['.env.test', '.env.infra'] })
process.env.NODE_ENV = 'test'

function generateShortId(length: number = 10): string {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    let result = ''
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }

    return result
}

global.beforeEach(() => {
    process.env.TEST_ID = generateShortId()
})
