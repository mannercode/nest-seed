import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'

import ts from 'typescript'

const TYPESCRIPT_FILE = /\.[cm]?tsx?$/
const DECLARATION_FILE = /\.d\.[cm]?ts$/

/**
 * Vitest의 Vite 경로에서 TypeScript 자체 변환기를 사용한다.
 * Nest DI가 의존하는 legacy decorator metadata를 보존하면서 Oxc/SWC 변환은 사용하지 않는다.
 */
export function createTypeScriptTransform(tsconfigPath) {
    const configFile = ts.readConfigFile(tsconfigPath, (path) => readFileSync(path, 'utf8'))
    if (configFile.error) throw new Error(ts.formatDiagnostics([configFile.error], diagnosticHost))

    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfigPath))
    if (parsed.errors.length > 0) {
        throw new Error(ts.formatDiagnostics(parsed.errors, diagnosticHost))
    }

    const compilerOptions = {
        ...parsed.options,
        declaration: false,
        declarationMap: false,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        inlineSources: true,
        isolatedModules: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: false,
        sourceMap: true
    }

    return {
        name: 'nest-typescript-transform',
        enforce: 'pre',
        transform(source, id) {
            const fileName = id.split('?')[0]
            if (
                !fileName ||
                fileName.includes('/node_modules/') ||
                !TYPESCRIPT_FILE.test(fileName) ||
                DECLARATION_FILE.test(fileName)
            ) {
                return undefined
            }

            const result = ts.transpileModule(source, {
                compilerOptions,
                fileName,
                reportDiagnostics: true,
                transformers: { after: [ignoreGeneratedDecoratorMetadataFallbacks] }
            })
            const errors = (result.diagnostics ?? []).filter(
                (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
            )
            if (errors.length > 0) throw new Error(ts.formatDiagnostics(errors, diagnosticHost))

            const map = result.sourceMapText ? JSON.parse(result.sourceMapText) : undefined
            if (map) map.sources = [fileName]

            return { code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, ''), map }
        }
    }
}

// 단일 파일 emit이 타입 존재 여부를 몰라 추가한 metadata fallback만 coverage에서 제외한다.
function ignoreGeneratedDecoratorMetadataFallbacks(context) {
    const visit = (node) => {
        const visited = ts.visitEachChild(node, visit, context)
        if (!isGeneratedDecoratorMetadataFallback(visited)) return visited

        return ts.addSyntheticLeadingComment(
            visited,
            ts.SyntaxKind.MultiLineCommentTrivia,
            ' v8 ignore next -- @preserve ',
            false
        )
    }
    return (sourceFile) => ts.visitNode(sourceFile, visit)
}

function isGeneratedDecoratorMetadataFallback(node) {
    if (
        node.pos >= 0 ||
        !ts.isConditionalExpression(node) ||
        !ts.isIdentifier(node.whenTrue) ||
        !ts.isIdentifier(node.whenFalse) ||
        node.whenFalse.text !== 'Object'
    ) {
        return false
    }

    const condition = node.condition
    if (
        !ts.isBinaryExpression(condition) ||
        condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
        !ts.isTypeOfExpression(condition.left) ||
        !ts.isStringLiteral(condition.right) ||
        condition.right.text !== 'function' ||
        !ts.isParenthesizedExpression(condition.left.expression)
    ) {
        return false
    }

    const assignment = condition.left.expression.expression
    if (
        !ts.isBinaryExpression(assignment) ||
        assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        !ts.isIdentifier(assignment.left) ||
        assignment.left.text !== node.whenTrue.text ||
        !ts.isBinaryExpression(assignment.right) ||
        assignment.right.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
    ) {
        return false
    }

    const definedCheck = assignment.right.left
    return (
        ts.isBinaryExpression(definedCheck) &&
        definedCheck.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
        ts.isTypeOfExpression(definedCheck.left) &&
        ts.isStringLiteral(definedCheck.right) &&
        definedCheck.right.text === 'undefined'
    )
}

export function createVitestBase({ tsconfigPath }) {
    return {
        // Vite 8의 Oxc metadata 지원은 부분적이므로 TypeScript compiler transform만 사용한다.
        oxc: false,
        plugins: [createTypeScriptTransform(tsconfigPath)],
        test: {
            globals: true,
            hookTimeout: 60_000,
            include: ['src/**/__tests__/**/*.spec.ts'],
            mockReset: true,
            reporters: ['tree'],
            restoreMocks: true,
            sequence: { hooks: 'list', setupFiles: 'list' },
            teardownTimeout: 60_000,
            testTimeout: 60_000
        }
    }
}

const diagnosticHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n'
}
