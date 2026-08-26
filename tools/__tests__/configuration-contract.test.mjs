import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const read = (path) => readFile(join(root, path), 'utf8')
const trackedPackageManifests = () =>
    execFileSync('git', ['ls-files', '--', 'package.json', '*/package.json'], {
        cwd: root,
        encoding: 'utf8'
    })
        .trim()
        .split('\n')
        .filter(Boolean)
        .sort()

test('root scripts keep cleanup and shell lint gates explicit', async () => {
    const packageJson = JSON.parse(await read('package.json'))
    const lintStaged = await read('.lintstagedrc.cjs')
    const lintStagedJavaScript = await read('tools/lint-staged-js.mjs')
    const npmrc = await read('.npmrc')

    assert.equal(packageJson.scripts.clean, 'node tools/clean-workspace.mjs')
    assert.match(packageJson.scripts.postlint, /node tools\/lint-shell\.mjs/)
    assert.match(packageJson.scripts.atoz, /npm run test:config/)
    assert.match(lintStagedJavaScript, /tests\/api-race/)
    assert.match(lintStaged, /apps\/api\/api-docs\/\*\.\{fixture,spec\}/)
    assert.match(lintStaged, /\.husky\/\*/)
    assert.match(npmrc, /^save-exact=true$/m)
})

test('lint-staged delegates JavaScript paths without shell re-quoting', () => {
    const config = require(join(root, '.lintstagedrc.cjs'))
    const javascriptTask = config['*.{cjs,js,mjs}']
    assert.equal(javascriptTask, 'node tools/lint-staged-js.mjs')
})

test('API JavaScript uses the Node recommended rules in workspace lint', async () => {
    const packageJson = JSON.parse(await read('apps/api/package.json'))
    assert.match(packageJson.scripts.lint, /eslint[^&]*'\*\.js'/)

    const printedConfig = JSON.parse(
        execFileSync(
            'npm',
            [
                'exec',
                '--workspace',
                'apps/api',
                '--',
                'eslint',
                '--print-config',
                'scripts/index.js'
            ],
            { cwd: root, encoding: 'utf8' }
        )
    )
    const noUndef = printedConfig.rules['no-undef']
    assert.equal(Array.isArray(noUndef) ? noUndef[0] : noUndef, 2)
})

test('installed dependency specs are exact while peer compatibility ranges stay independent', async () => {
    for (const manifest of trackedPackageManifests()) {
        const packageJson = JSON.parse(await read(manifest))
        for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
            for (const [dependency, spec] of Object.entries(packageJson[section] ?? {})) {
                if (dependency.startsWith('@mannercode/')) {
                    assert.equal(spec, '*', `${manifest} ${section}.${dependency} must be local`)
                } else {
                    assert.match(
                        spec,
                        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
                        `${manifest} ${section}.${dependency} must use a full exact version`
                    )
                }
            }
        }
    }
})

test('devcontainer preserves install, naming, and credential mount behavior', async () => {
    const config = await read('.devcontainer/devcontainer.json')
    const lock = JSON.parse(await read('.devcontainer/devcontainer-lock.json'))

    assert.match(config, /"postCreateCommand"\s*:\s*\{\s*"install"\s*:\s*"npm install"/)
    assert.match(config, /\$\{localEnv:USER:unknown\}-\$\{localWorkspaceFolderBasename\}/)
    assert.match(config, /\.codex,target=\/home\/node\/\.codex,type=bind/)
    assert.match(config, /\.config\/gh,target=\/home\/node\/\.config\/gh,type=bind/)
    assert.match(config, /\.claude,target=\/home\/node\/\.claude,type=bind/)
    assert.match(config, /\.claude\.json,target=\/home\/node\/\.claude\.json,type=bind/)
    for (const feature of Object.values(lock.features)) {
        assert.match(feature.resolved, /@sha256:[a-f0-9]{64}$/)
        assert.match(feature.integrity, /^sha256:[a-f0-9]{64}$/)
    }
})

test('devcontainer global install treats allow-scripts as an option, not a duplicate package', async () => {
    const dockerfile = (await read('.devcontainer/Dockerfile')).replace(/\\\n\s*/g, ' ')
    const install = [...dockerfile.matchAll(/npm i -g ([^;]+);/g)]
        .map((match) => match[1])
        .find((command) => command.includes('@anthropic-ai/claude-code'))
    assert.ok(install, 'global npm install command must exist')

    const arguments_ = install.trim().split(/\s+/)
    assert.ok(arguments_.includes('--allow-scripts=@anthropic-ai/claude-code'))
    assert.deepEqual(
        arguments_.filter(
            (argument) =>
                !argument.startsWith('--') && argument.startsWith('@anthropic-ai/claude-code')
        ),
        ['@anthropic-ai/claude-code@2.1.237']
    )
})

test('dependency image copies and hashes every tracked package manifest', async (t) => {
    const dockerfile = await read('deploy/deps.Dockerfile')
    const copied = new Set()
    for (const match of dockerfile.matchAll(/^COPY\s+(.+)$/gm)) {
        const fields = match[1].trim().split(/\s+/)
        for (const source of fields.slice(0, -1)) {
            if (source.endsWith('package.json')) copied.add(source.replace(/^\.\//, ''))
        }
    }
    assert.deepEqual([...copied].sort(), trackedPackageManifests())

    const mockBin = await mkdtemp(join(tmpdir(), 'nest-seed-docker-mock-'))
    t.after(async () => {
        const { rm } = await import('node:fs/promises')
        await rm(mockBin, { force: true, recursive: true })
    })
    const docker = join(mockBin, 'docker')
    await writeFile(docker, '#!/bin/sh\nexit 0\n')
    await chmod(docker, 0o755)

    const actual = execFileSync(
        'bash',
        ['-c', '. "$WORKSPACE_ROOT/deploy/ensure-deps-image.sh"; printf %s "$DEPS_TAG"'],
        {
            cwd: root,
            encoding: 'utf8',
            env: { ...process.env, PATH: `${mockBin}:${process.env.PATH}`, WORKSPACE_ROOT: root }
        }
    )
    const inputs = [
        '.npmrc',
        'deploy/deps.Dockerfile',
        'package-lock.json',
        ...trackedPackageManifests()
    ]
    const checksums = []
    for (const input of inputs) {
        const digest = createHash('sha256')
            .update(await read(input))
            .digest('hex')
        checksums.push(`${digest}  ${input}\n`)
    }
    const expected = createHash('sha256').update(checksums.join('')).digest('hex').slice(0, 16)
    assert.equal(actual, expected)
})

test('dependency image hashing failure stops before Docker', async (t) => {
    const mockBin = await mkdtemp(join(tmpdir(), 'nest-seed-hash-failure-'))
    const dockerLog = join(mockBin, 'docker.log')
    t.after(async () => {
        const { rm } = await import('node:fs/promises')
        await rm(mockBin, { force: true, recursive: true })
    })

    await Promise.all([
        writeFile(join(mockBin, 'sha256sum'), '#!/bin/sh\nexit 7\n'),
        writeFile(
            join(mockBin, 'docker'),
            '#!/bin/sh\nprintf "%s\\n" "$*" >>"$DOCKER_LOG"\nexit 0\n'
        )
    ])
    await Promise.all([
        chmod(join(mockBin, 'sha256sum'), 0o755),
        chmod(join(mockBin, 'docker'), 0o755)
    ])

    const result = spawnSync(
        'bash',
        [
            '-c',
            'load_deps() { . "$WORKSPACE_ROOT/deploy/ensure-deps-image.sh" || return 1; printf continued; }; load_deps'
        ],
        {
            cwd: root,
            encoding: 'utf8',
            env: {
                ...process.env,
                DOCKER_LOG: dockerLog,
                PATH: `${mockBin}:${process.env.PATH}`,
                WORKSPACE_ROOT: root
            }
        }
    )
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /continued/)
    await assert.rejects(readFile(dockerLog), { code: 'ENOENT' })
})

test('network-facing development ports bind only to loopback', async () => {
    assert.match(await read('deploy/compose.yml'), /127\.0\.0\.1:3000:80/)
    assert.match(await read('infra/compose.minio.yml'), /127\.0\.0\.1:9001:9001/)
})

test('container base and infrastructure image references are digest-pinned', async () => {
    const infraEnv = await read('.env.infra')
    for (const line of infraEnv
        .split('\n')
        .filter((entry) => /^[A-Z_]+_IMAGE=/.test(entry) && !entry.startsWith('MONGO_IMAGE='))) {
        assert.match(line, /@sha256:[a-f0-9]{64}$/, `${line.split('=')[0]} must be digest-pinned`)
    }

    const mongoImage = infraEnv.match(/^MONGO_IMAGE=(.+)$/m)?.[1]
    const mongoDigest = infraEnv.match(/^MONGO_IMAGE_DIGEST=(.+)$/m)?.[1]
    assert.match(mongoImage ?? '', /^mongo:\d+\.\d+\.\d+$/)
    assert.match(mongoDigest ?? '', /^sha256:[a-f0-9]{64}$/)
    assert.match(`${mongoImage}@${mongoDigest}`, /^mongo:\d+\.\d+\.\d+@sha256:[a-f0-9]{64}$/)

    const mongoCompose = await read('infra/compose.mongo.yml')
    assert.equal(
        mongoCompose.match(/image: \$\{MONGO_IMAGE\}@\$\{MONGO_IMAGE_DIGEST\}/g)?.length,
        2,
        'Mongo services must compose the Testcontainers-compatible tag with its immutable digest'
    )

    const nodeBaseImages = []
    for (const dockerfile of [
        '.devcontainer/Dockerfile',
        'apps/api/Dockerfile',
        'deploy/deps.Dockerfile'
    ]) {
        const contents = await read(dockerfile)
        const stages = new Set()
        for (const [, image, alias] of contents.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/gim)) {
            if (stages.has(image)) continue
            if (image.startsWith('nest-seed-deps:')) continue
            assert.match(image, /@sha256:[a-f0-9]{64}$/, `${dockerfile} base image must be pinned`)
            if (image.startsWith('node:')) nodeBaseImages.push(image)
            if (alias) stages.add(alias)
        }
    }
    assert.equal(nodeBaseImages.length, 3)
    assert.equal(
        new Set(nodeBaseImages).size,
        1,
        'devcontainer, dependency builder, and API runtime must use one Node tag and digest'
    )

    for (const compose of ['deploy/compose.yml', 'infra/compose.minio.yml', 'infra/compose.yml']) {
        const contents = await read(compose)
        for (const [, image] of contents.matchAll(/^\s*image:\s+([^$\s][^\s]*)/gm)) {
            if (image === 'nest-seed-api') continue
            assert.match(image, /@sha256:[a-f0-9]{64}$/, `${compose} image must be pinned`)
        }
    }
})

test('Temporal PostgreSQL 18 persists its versioned data directory through the parent mount', async () => {
    const infraEnv = await read('.env.infra')
    assert.match(infraEnv, /^TEMPORAL_POSTGRES_IMAGE=postgres:18\.4-alpine@sha256:[a-f0-9]{64}$/m)

    const temporalCompose = await read('infra/temporal/compose.temporal.yml')
    assert.match(temporalCompose, /temporal_pgdata:\/var\/lib\/postgresql(?:\s|$)/)
    assert.doesNotMatch(temporalCompose, /temporal_pgdata:\/var\/lib\/postgresql\/data/)
    assert.equal(
        temporalCompose.match(/^\s+DB: postgres12$/gm)?.length,
        2,
        'Temporal keeps the postgres12 compatibility plugin for PostgreSQL 12 and later'
    )

    const schemaSetup = await read('infra/temporal/scripts/setup-postgres.sh')
    assert.equal(schemaSetup.match(/--plugin postgres12/g)?.length, 6)
    assert.equal(schemaSetup.match(/\/schema\/postgresql\/v12\//g)?.length, 2)
})

test('GitHub workflows pin actions, protect scheduled forks, and retain diagnostics', async () => {
    for (const workflow of [
        '.github/workflows/test-atoz.yaml',
        '.github/workflows/test-stability.yaml'
    ]) {
        const contents = await read(workflow)
        assert.doesNotMatch(contents, /uses:\s+[^\s]+@v\d/)
        assert.match(contents, /uses:\s+[^\s]+@[a-f0-9]{40}(?:\s+#\s+v[^\s]+)?/)
        assert.match(
            contents,
            /github\.event_name != 'schedule' \|\| github\.repository_id == '849585972' \|\| vars\.ENABLE_SCHEDULED_CI == 'true'/
        )
        assert.doesNotMatch(contents, /github\.repository ==/)
        assert.match(contents, /git diff --exit-code -- package-lock\.json/)
    }
    const atoz = await read('.github/workflows/test-atoz.yaml')
    assert.match(atoz, /_output\/deploy-diagnostics/)
    assert.match(atoz, /_output\/ci-diagnostics/)
})

test('Stability keeps 60 API repetitions within three timeout-safe jobs', async () => {
    const workflow = await read('.github/workflows/test-stability.yaml')
    const apiJobs = [
        ...workflow.matchAll(
            /- leg: unit-api-(\d+)\n\s+timeout: (\d+)\n\s+run: \|\n\s+npm run build\n\s+RESET_EVERY=5 bash \.github\/scripts\/repeat\.sh (\d+) npm test -w apps\/api/g
        )
    ].map(([, leg, timeout, repetitions]) => ({
        leg: Number(leg),
        repetitions: Number(repetitions),
        timeout: Number(timeout)
    }))

    assert.deepEqual(apiJobs, [
        { leg: 1, repetitions: 20, timeout: 240 },
        { leg: 2, repetitions: 20, timeout: 240 },
        { leg: 3, repetitions: 20, timeout: 240 }
    ])
    assert.equal(
        apiJobs.reduce((total, job) => total + job.repetitions, 0),
        60
    )
})

test('Dependabot only proposes grouped routine updates and keeps major updates manual', async () => {
    const config = await read('.github/dependabot.yml')
    const workflow = await read('.github/workflows/dependabot-auto-merge.yaml')

    const ecosystems = [...config.matchAll(/^\s+- package-ecosystem:/gm)]
    const routineAllowLists = [
        ...config.matchAll(
            /allow:\s+- dependency-name: '\*'\s+update-types:\s+- version-update:semver-minor\s+- version-update:semver-patch/g
        )
    ]
    assert.equal(ecosystems.length, 4)
    assert.equal(routineAllowLists.length, ecosystems.length)
    assert.equal(config.match(/update-types:\s*\['minor', 'patch'\]/g)?.length, ecosystems.length)
    assert.match(
        config,
        /package-ecosystem: docker\s+directories:\s+- '\/\.devcontainer'\s+- '\/apps\/api'\s+- '\/deploy'/
    )
    assert.equal(config.match(/group-by: dependency-name/g)?.length, 2)
    assert.match(
        config,
        /package-ecosystem: docker-compose\s+directories:\s+- '\/deploy'\s+- '\/infra'/
    )
    assert.match(workflow, /dependabot\/fetch-metadata@[a-f0-9]{40}/)
    assert.match(workflow, /version-update:semver-major/)
})
