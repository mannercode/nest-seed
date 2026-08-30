import assert from 'node:assert/strict'
import { glob, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const read = (path) => readFile(join(root, path), 'utf8')

test('workspace keeps explicit package and install safety policy', async () => {
    const packageJson = JSON.parse(await read('package.json'))
    const workspace = await read('pnpm-workspace.yaml')

    assert.match(packageJson.packageManager, /^pnpm@\d+\.\d+\.\d+$/)
    assert.equal(packageJson.workspaces, undefined)
    assert.match(packageJson.scripts.atoz, /pnpm run test:config/)
    assert.match(workspace, /^saveExact: true$/m)
    assert.match(workspace, /^strictDepBuilds: true$/m)
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

test('devcontainer installs the frozen lock and pins resolved features', async () => {
    const config = await read('.devcontainer/devcontainer.json')
    const lock = JSON.parse(await read('.devcontainer/devcontainer-lock.json'))

    assert.match(
        config,
        /"postCreateCommand"\s*:\s*\{\s*"install"\s*:\s*"pnpm install --frozen-lockfile"/
    )
    for (const feature of Object.values(lock.features)) {
        assert.match(feature.resolved, /@sha256:[a-f0-9]{64}$/)
        assert.match(feature.integrity, /^sha256:[a-f0-9]{64}$/)
    }
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

    for (const packageJson of [apiPackage, commonPackage, testingPackage]) {
        assert.match(packageJson.scripts.test, /^vitest run/)
    }

    const { createVitestBase } = await import(
        pathToFileURL(join(root, 'vitest.config.base.mjs')).href
    )
    const vitestBase = createVitestBase({ tsconfigPath: join(root, 'apps/api/tsconfig.json') })
    assert.equal(vitestBase.oxc, false)

    const transformed = vitestBase.plugins[0].transform(
        "import { Injectable } from '@nestjs/common'\nclass Dependency {}\n@Injectable()\nexport class Fixture { constructor(readonly dependency: Dependency) {} }\n",
        join(root, 'apps/api/src/__tests__/metadata.fixture.ts')
    )
    assert.match(transformed.code, /from ['\"]@nestjs\/common['\"]/)
    assert.match(transformed.code, /__metadata\(['\"]design:paramtypes['\"]/)
    assert.doesNotMatch(transformed.code, /\brequire\s*\(/)
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

    assert.equal(config.entry, join(root, 'apps/api/src/main.ts'))
    assert.equal(config.output.module, true)
    assert.equal(config.output.chunkFormat, 'module')
    assert.equal(config.experiments.outputModule, true)
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
    assert.doesNotMatch(JSON.stringify(config), /(?:builtin:)?swc-loader|@swc\//i)
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

test('Stability preserves its scheduled repetition volume without building the bootup leg', async () => {
    const workflow = await read('.github/workflows/test-stability.yaml')
    const leg = (name) => {
        const marker = `- leg: ${name}`
        const start = workflow.indexOf(marker)
        assert.notEqual(start, -1, `${name} stability leg is missing`)
        const next = workflow.indexOf('\n                    - leg:', start + marker.length)
        return workflow.slice(start, next === -1 ? undefined : next)
    }

    assert.match(workflow, /cron: '27 \*\/6 \* \* \*'/)
    assert.match(leg('unit-libs'), /repeat\.sh 75 /)
    for (const name of ['unit-api-1', 'unit-api-2', 'unit-api-3']) {
        assert.match(leg(name), /timeout: 240/)
        assert.match(leg(name), /RESET_EVERY=5 bash \.github\/scripts\/repeat\.sh 20 /)
        assert.match(leg(name), /--filter '\.\/apps\/api'/)
    }

    const bootup = leg('bootup')
    assert.match(bootup, /repeat\.sh 50 bash infra\/reset\.sh/)
    assert.doesNotMatch(bootup, /pnpm run build/)

    for (const name of [
        'sse-fanout-race',
        'user-signup-race',
        'ticket-holding-race',
        'showtime-overlap-race',
        'purchase-double-spend',
        'purchase-overlap-race',
        'replica-chaos',
        'jwt-refresh-race'
    ]) {
        assert.match(leg(name), /repeat\.sh 50 /)
    }
})

test('Stability failure diagnostics stay inside the current Compose project', async () => {
    const repeat = await read('.github/scripts/repeat.sh')
    assert.equal(
        repeat.match(/--filter "label=com\.docker\.compose\.project=\$\{compose_project\}"/g)
            ?.length,
        2
    )
    assert.doesNotMatch(repeat, /docker stats -a/)
})
