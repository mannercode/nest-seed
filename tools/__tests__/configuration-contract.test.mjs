import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmod, glob, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
    const workspace = await read('pnpm-workspace.yaml')

    assert.equal(packageJson.packageManager, 'pnpm@11.24.0')
    assert.equal(packageJson.workspaces, undefined)
    assert.equal(packageJson.scripts.clean, 'node tools/clean-workspace.mjs')
    assert.match(packageJson.scripts['lint:root'], /node tools\/lint-shell\.mjs/)
    assert.match(packageJson.scripts.lint, /pnpm run lint:root/)
    assert.match(packageJson.scripts.atoz, /pnpm run test:config/)
    assert.match(
        packageJson.scripts.atoz,
        /--filter '\.\/libs\/\*\*'[^&]*--fail-if-no-match run atoz/
    )
    assert.match(packageJson.scripts.atoz, /--filter '!\.\/libs\/\*\*'[^&]*run atoz/)
    assert.match(packageJson.scripts.atoz, /pnpm run lint:root/)
    assert.doesNotMatch(packageJson.scripts.atoz, /pnpm run lint(?:\s|&&)/)
    for (const script of ['pretest', 'predev']) {
        assert.match(packageJson.scripts[script], /--fail-if-no-match/)
        assert.doesNotMatch(packageJson.scripts[script], /--if-present/)
    }
    assert.match(lintStagedJavaScript, /tests\/api-race/)
    assert.match(lintStaged, /apps\/api\/api-docs\/\*\.\{fixture,spec\}/)
    assert.match(lintStaged, /\.husky\/\*/)
    assert.match(workspace, /^saveExact: true$/m)
    assert.match(workspace, /^strictDepBuilds: true$/m)
    for (const pattern of ['apps/*', 'libs/*', 'tests/*', 'tools/*']) {
        assert.match(workspace, new RegExp(`^\\s+- '${pattern.replace('*', '\\*')}'$`, 'm'))
    }
})

test('lint-staged delegates JavaScript paths without shell re-quoting', () => {
    const config = require(join(root, '.lintstagedrc.cjs'))
    const javascriptTask = config['*.{cjs,js,mjs}']
    assert.equal(javascriptTask, 'node tools/lint-staged-js.mjs')
})

test('API JavaScript uses the Node recommended rules in workspace lint', async () => {
    const packageJson = JSON.parse(await read('apps/api/package.json'))
    assert.match(packageJson.scripts.lint, /eslint[^&]*'\*\.cjs'/)

    const printedConfig = JSON.parse(
        execFileSync(
            'pnpm',
            [
                '--filter',
                './apps/api',
                '--fail-if-no-match',
                'exec',
                'eslint',
                '--print-config',
                'scripts/index.cjs'
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
                    assert.equal(
                        spec,
                        'workspace:*',
                        `${manifest} ${section}.${dependency} must be local`
                    )
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
    const dockerfile = await read('.devcontainer/Dockerfile')
    const lock = JSON.parse(await read('.devcontainer/devcontainer-lock.json'))

    assert.match(
        config,
        /"postCreateCommand"\s*:\s*\{\s*"install"\s*:\s*"pnpm install --frozen-lockfile"/
    )
    assert.match(dockerfile, /ARG PNPM_VERSION=\d+\.\d+\.\d+/)
    assert.match(dockerfile, /"pnpm@\$\{PNPM_VERSION\}"/)
    assert.match(dockerfile, /pnpm --version/)
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
        'deploy/deps.Dockerfile',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'tools/dev-tools/free-port.js',
        'tools/dev-tools/tunnel.sh',
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

test('API image passes production mode to pnpm deploy without mutating the build workspace', async () => {
    const dockerfile = await read('apps/api/Dockerfile')
    assert.match(dockerfile, /--fail-if-no-match deploy --prod --legacy/)
    assert.doesNotMatch(dockerfile, /--prod deploy/)
})

test('backend workspaces use Node ESM and Vitest keeps the TypeScript metadata transform', async () => {
    const typescript = require('typescript')
    const rootTsconfig = typescript.parseConfigFileTextToJson(
        'tsconfig.json',
        await read('tsconfig.json')
    ).config
    const rootPackage = JSON.parse(await read('package.json'))
    const apiPackage = JSON.parse(await read('apps/api/package.json'))
    const commonPackage = JSON.parse(await read('libs/common/package.json'))
    const testingPackage = JSON.parse(await read('libs/testing/package.json'))

    assert.equal(rootTsconfig.compilerOptions.module, 'nodenext')
    assert.equal(rootTsconfig.compilerOptions.moduleResolution, 'nodenext')
    assert.equal(rootTsconfig.compilerOptions.rewriteRelativeImportExtensions, true)
    for (const packageJson of [apiPackage, commonPackage, testingPackage]) {
        assert.equal(packageJson.type, 'module')
    }
    assert.deepEqual(commonPackage.files, ['_output/dist'])
    assert.deepEqual(Object.keys(apiPackage.imports).sort(), [
        '#application',
        '#config',
        '#core',
        '#gateway',
        '#infrastructure',
        '#view'
    ])

    for (const path of [
        'apps/api/tsconfig.test.json',
        'libs/common/tsconfig.test.json',
        'libs/testing/tsconfig.test.json'
    ]) {
        const testTsconfig = typescript.getParsedCommandLineOfConfigFile(
            join(root, path),
            {},
            {
                ...typescript.sys,
                onUnRecoverableConfigFileDiagnostic(diagnostic) {
                    assert.fail(
                        typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
                    )
                }
            }
        )
        assert.ok(testTsconfig)
        assert.equal(testTsconfig.options.module, typescript.ModuleKind.NodeNext)
        assert.equal(
            testTsconfig.options.moduleResolution,
            typescript.ModuleResolutionKind.NodeNext
        )
        assert.equal(testTsconfig.options.isolatedModules, true)
        assert.deepEqual([...testTsconfig.options.types].sort(), ['node', 'vitest/globals'])
    }

    for (const packageJson of [rootPackage, apiPackage, commonPackage, testingPackage]) {
        const dependencyNames = Object.keys({
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        })
        for (const removed of ['@types/jest', 'eslint-plugin-jest', 'jest', 'ts-jest']) {
            assert.equal(dependencyNames.includes(removed), false)
        }
    }
    assert.equal(rootPackage.devDependencies.vitest, '4.1.11')
    assert.equal(rootPackage.devDependencies['@vitest/coverage-v8'], '4.1.11')
    for (const packageJson of [apiPackage, commonPackage, testingPackage]) {
        assert.match(packageJson.scripts.test, /^vitest run/)
    }

    const { createVitestBase } = await import(
        pathToFileURL(join(root, 'vitest.config.base.mjs')).href
    )
    const vitestBase = createVitestBase({ tsconfigPath: join(root, 'apps/api/tsconfig.json') })
    assert.equal(vitestBase.oxc, false)
    assert.deepEqual(vitestBase.test.reporters, ['tree'])
    assert.equal(vitestBase.test.pool, 'forks')
    assert.equal(vitestBase.test.isolate, true)

    const transformed = vitestBase.plugins[0].transform(
        "import { Injectable } from '@nestjs/common'\nclass Dependency {}\n@Injectable()\nexport class Fixture { constructor(readonly dependency: Dependency) {} }\n",
        join(root, 'apps/api/src/__tests__/metadata.fixture.ts')
    )
    assert.match(transformed.code, /from ['\"]@nestjs\/common['\"]/)
    assert.match(transformed.code, /__metadata\(['\"]design:paramtypes['\"]/)
    assert.doesNotMatch(transformed.code, /\brequire\s*\(/)

    for (const path of ['apps/api/vitest.config.mjs', 'libs/common/vitest.config.mjs']) {
        const config = await read(path)
        assert.match(config, /provider:\s*'v8'/)
        assert.match(config, /thresholds:\s*\{ 100: true \}/)
        assert.match(config, /reporters?:\s*\[/)
    }
})

test('backend TypeScript relative specifiers include runtime extensions', async () => {
    const typescript = require('typescript')
    const files = await Array.fromAsync(
        glob('{apps/api/src,libs/common/src,libs/testing/src}/**/*.ts', { cwd: root })
    )

    for (const file of files) {
        const source = typescript.createSourceFile(
            file,
            await read(file),
            typescript.ScriptTarget.Latest,
            true
        )
        const visit = (node) => {
            let specifier
            if (
                (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
                node.moduleSpecifier &&
                typescript.isStringLiteral(node.moduleSpecifier)
            ) {
                specifier = node.moduleSpecifier.text
            } else if (
                typescript.isCallExpression(node) &&
                node.expression.kind === typescript.SyntaxKind.ImportKeyword &&
                node.arguments.length === 1 &&
                typescript.isStringLiteral(node.arguments[0])
            ) {
                specifier = node.arguments[0].text
            }

            if (specifier?.startsWith('.')) {
                assert.match(specifier, /\.(?:[cm]?js|json)$/, `${file}: ${specifier}`)
            }
            typescript.forEachChild(node, visit)
        }
        visit(source)
    }
})

test('API request bodies and queries declare a Standard Schema', async () => {
    const typescript = require('typescript')
    const files = await Array.fromAsync(
        glob('apps/api/src/services/gateway/**/*.http-controller.ts', { cwd: root })
    )
    let requestDecoratorCount = 0

    for (const file of files) {
        const source = typescript.createSourceFile(
            file,
            await read(file),
            typescript.ScriptTarget.Latest,
            true
        )
        const visit = (node) => {
            if (typescript.isDecorator(node) && typescript.isCallExpression(node.expression)) {
                const call = node.expression
                const name = typescript.isIdentifier(call.expression)
                    ? call.expression.text
                    : undefined
                if (name === 'Body' || name === 'Query') {
                    requestDecoratorCount += 1
                    const hasSchema = call.arguments.some(
                        (argument) =>
                            typescript.isObjectLiteralExpression(argument) &&
                            argument.properties.some(
                                (property) =>
                                    typescript.isPropertyAssignment(property) &&
                                    typescript.isIdentifier(property.name) &&
                                    property.name.text === 'schema'
                            )
                    )
                    assert.equal(hasSchema, true, `${file}: @${name} must declare { schema }`)
                }
            }
            typescript.forEachChild(node, visit)
        }
        visit(source)
    }

    assert.ok(requestDecoratorCount > 0, 'no API request decorators were inspected')
})

test('API build preserves Nest Rspack ESM defaults and replaces only the SWC loader', async () => {
    const packageJson = JSON.parse(await read('apps/api/package.json'))
    const nestCli = JSON.parse(await read('apps/api/nest-cli.json'))
    const dockerignore = await read('.dockerignore')
    const createConfig = require(join(root, 'apps/api/rspack.config.cjs'))
    class TypeCheckPlugin {}
    const defaults = {
        entry: join(root, 'apps/api/src/development.ts'),
        experiments: { outputModule: true },
        module: { rules: [{ type: 'javascript/esm', use: [{ loader: 'builtin:swc-loader' }] }] },
        output: { chunkFormat: 'module', module: true },
        externals: [() => undefined],
        resolve: {},
        plugins: [new TypeCheckPlugin()]
    }
    const config = createConfig(defaults)
    const loaders = config.module.rules.flatMap((rule) =>
        (Array.isArray(rule.use) ? rule.use : [rule.use]).filter(Boolean)
    )

    assert.equal(packageJson.scripts.build, 'nest build -b rspack --rspackPath rspack.config.cjs')
    assert.equal(packageJson.scripts.dev, 'nest start --watch')
    assert.equal(nestCli.compilerOptions.builder, 'tsc')
    assert.equal(packageJson.devDependencies['@rspack/core'], '2.2.1')
    assert.match(dockerignore, /^!\/apps\/\*\/rspack\.config\.cjs$/m)
    assert.doesNotMatch(dockerignore, /webpack\.config/)
    assert.equal(config.entry, join(root, 'apps/api/src/main.ts'))
    assert.equal(config.output.path, join(root, 'apps/api/_output/dist'))
    assert.equal(config.output.filename, 'index.js')
    assert.equal(config.output.module, true)
    assert.equal(config.output.chunkFormat, 'module')
    assert.equal(config.experiments.outputModule, true)
    assert.equal(config.module.rules[0].type, 'javascript/esm')
    assert.deepEqual(
        loaders.map((loader) => (typeof loader === 'string' ? loader : loader.loader)),
        [require.resolve(join(root, 'apps/api/node_modules/ts-loader'))]
    )
    assert.equal(loaders[0].options.configFile, join(root, 'apps/api/tsconfig.build.json'))
    assert.deepEqual(loaders[0].options.compilerOptions, {
        module: 'ESNext',
        moduleResolution: 'Bundler'
    })
    assert.equal(loaders[0].options.transpileOnly, true)
    assert.equal(config.context, join(root, 'apps/api'))
    assert.equal(config.resolve.tsConfig, join(root, 'apps/api/tsconfig.build.json'))
    assert.deepEqual(config.resolve.plugins, [])
    assert.deepEqual(config.plugins, defaults.plugins)
    // ESM 번들 안에 CommonJS 패키지를 섞지 않고, common도 빌드 산출물째 배포한다.
    assert.deepEqual(config.externals, defaults.externals)
    assert.doesNotMatch(JSON.stringify(config), /(?:builtin:)?swc-loader|@swc\//i)
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

test('network-facing deployment port binds only to loopback', async () => {
    assert.match(await read('deploy/compose.yml'), /127\.0\.0\.1:3000:80/)
})

test('local S3 service is internal-only and exposes a dedicated health endpoint', async () => {
    const s3Compose = await read('infra/compose.s3.yml')
    assert.doesNotMatch(s3Compose, /^\s*ports:/m)
    assert.match(s3Compose, /image:\s*\$\{S3_IMAGE\}/)
    assert.match(s3Compose, /VGW_HEALTH:\s*\/_\/health/)
    assert.match(s3Compose, /VGW_BACKEND:\s*posix/)
    assert.match(s3Compose, /-\s+s3_data:\/data/)
    assert.match(s3Compose, /wget -q -O \/dev\/null/)
    assert.doesNotMatch(s3Compose, /^\s*test:.*--spider/m)
    assert.doesNotMatch(s3Compose, /VGW_(?:ADMIN|WEBUI)_PORT/)
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

    for (const compose of ['deploy/compose.yml', 'infra/compose.s3.yml', 'infra/compose.yml']) {
        const contents = await read(compose)
        for (const [, image] of contents.matchAll(/^\s*image:\s+([^$\s][^\s]*)/gm)) {
            if (image === 'nest-seed-api') continue
            assert.match(image, /@sha256:[a-f0-9]{64}$/, `${compose} image must be pinned`)
        }
    }
})

test('deployment logs stay on structured stdout with bounded Docker files', async () => {
    const deployCompose = await read('deploy/compose.yml')
    const nginx = await read('deploy/nginx.conf')

    assert.equal(
        deployCompose.match(
            /logging: \{ driver: json-file, options: \{ max-size: '10m', max-file: '3' \} \}/g
        )?.length,
        2
    )
    assert.doesNotMatch(deployCompose, /co\.elastic\.logs/)
    assert.match(nginx, /access_log \/dev\/stdout ecs_json/)
    assert.match(nginx, /error_log\s+\/dev\/stderr warn/)
    assert.match(nginx, /\/health 0/)
})

test('Restate keeps durable execution data on its named volume', async () => {
    const infraEnv = await read('.env.infra')
    assert.match(infraEnv, /^RESTATE_IMAGE=.+@sha256:[a-f0-9]{64}$/m)

    const restateCompose = await read('infra/restate/compose.restate.yml')
    assert.match(restateCompose, /RESTATE_NODE_NAME: restate-1/)
    assert.match(restateCompose, /restate_data:\/restate-data/)
    assert.match(restateCompose, /http:\/\/localhost:9070\/health/)
    assert.match(restateCompose, /http:\/\/localhost:8080\/restate\/health/)
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
        assert.match(contents, /git diff --exit-code -- pnpm-lock\.yaml pnpm-workspace\.yaml/)
    }
    const atoz = await read('.github/workflows/test-atoz.yaml')
    assert.match(atoz, /_output\/deploy-diagnostics/)
    assert.match(atoz, /_output\/ci-diagnostics/)
})

test('Stability keeps 60 API repetitions within three timeout-safe jobs', async () => {
    const workflow = await read('.github/workflows/test-stability.yaml')
    const apiJobs = [
        ...workflow.matchAll(
            /- leg: unit-api-(\d+)\n\s+timeout: (\d+)\n\s+run: \|\n\s+pnpm run build\n\s+RESET_EVERY=5 bash \.github\/scripts\/repeat\.sh (\d+) pnpm --filter '\.\/apps\/api' --fail-if-no-match run test/g
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

test('Dependabot keeps routine updates direct, related, and non-major', async () => {
    const config = await read('.github/dependabot.yml')
    const workflow = await read('.github/workflows/dependabot-auto-merge.yaml')

    const ecosystems = [...config.matchAll(/^\s+- package-ecosystem:/gm)]
    const directRoutineAllowLists = [
        ...config.matchAll(
            /allow:\s+- dependency-type: direct\s+update-types:\s+- version-update:semver-minor\s+- version-update:semver-patch/g
        )
    ]
    assert.equal(ecosystems.length, 4)
    assert.equal(directRoutineAllowLists.length, ecosystems.length)

    const npm = config.slice(
        config.indexOf('- package-ecosystem: npm'),
        config.indexOf('- package-ecosystem: github-actions')
    )
    assert.doesNotMatch(npm, /patterns:\s*\['\*'\]/)
    for (const group of ['aws-sdk', 'next', 'nestjs', 'restate', 'react', 'eslint', 'commitlint']) {
        assert.match(npm, new RegExp(`${group}-minor-patch:`))
    }
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
