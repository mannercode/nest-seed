const { hash } = require('bcrypt')
const { MongoClient, ObjectId } = require('mongodb')
const { createInterface } = require('node:readline/promises')
const { Writable } = require('node:stream')
const { z } = require('zod')

const BCRYPT_SALT_ROUNDS = 10
const environmentSchema = z.object({
    MONGO_DATABASE: z.string().min(1),
    MONGO_URI: z.string().min(1)
})
const adminSchema = z.object({
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(1)
})

async function promptForAdmin() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        process.stdout.write('Admin email: \nAdmin name: \nAdmin password: \n')

        let input = ''
        for await (const chunk of process.stdin) input += chunk

        const [email, name, password] = input.split(/\r?\n/)
        return adminSchema.parse({ email, name, password })
    }

    let hideOutput = false
    const output = new Writable({
        write(chunk, encoding, callback) {
            if (!hideOutput) process.stdout.write(chunk, encoding)
            callback()
        }
    })
    const prompt = createInterface({ input: process.stdin, output, terminal: true })

    try {
        const email = await prompt.question('Admin email: ')
        const name = await prompt.question('Admin name: ')

        process.stdout.write('Admin password: ')
        hideOutput = true
        const password = await prompt.question('')
        hideOutput = false
        process.stdout.write('\n')

        return adminSchema.parse({ email, name, password })
    } finally {
        hideOutput = false
        prompt.close()
    }
}

async function createAdmin() {
    const environment = environmentSchema.parse(process.env)
    const admin = await promptForAdmin()
    const client = new MongoClient(environment.MONGO_URI)

    try {
        await client.connect()

        const admins = client.db(environment.MONGO_DATABASE).collection('admins')
        await admins.createIndexes([
            { key: { deletedAt: 1 } },
            { key: { email: 1, deletedAt: 1 }, unique: true }
        ])

        const now = new Date()
        await admins.insertOne({
            __v: 0,
            _id: new ObjectId(),
            authVersion: 0,
            createdAt: now,
            deletedAt: null,
            email: admin.email,
            name: admin.name,
            password: await hash(admin.password, BCRYPT_SALT_ROUNDS),
            updatedAt: now
        })

        console.log(`Admin created: ${admin.email}`)
    } finally {
        await client.close()
    }
}

createAdmin().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
