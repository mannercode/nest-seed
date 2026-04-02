class ContentDispositionParser {
    static parse(cd: string): Map<string, string> {
        const params = new Map<string, string>()
        const parts = cd.split(';')

        for (const part of parts.slice(1)) {
            const eqIdx = part.indexOf('=')
            if (eqIdx < 0) continue

            const key = part.slice(0, eqIdx).trim().toLowerCase()
            let value = part.slice(eqIdx + 1).trim()

            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1)
            }

            params.set(key, value)
        }

        return params
    }
}

export class HttpUtil {
    static buildContentDisposition(filename: string): string {
        const asciiFallbackRaw = filename
            .trim()
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/[^\x20-\x7E]/g, '_')
        const asciiFallback = asciiFallbackRaw.length > 0 ? asciiFallbackRaw : 'file'

        const utf8Star = encodeURIComponent(filename)
            .replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
            .replace(/%20/g, '+')

        return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Star}`
    }

    static extractContentDisposition(cd: string): string {
        const params = ContentDispositionParser.parse(cd)

        // filename*=UTF-8''...
        const starValue = params.get('filename*')

        if (starValue) {
            const sepIdx = starValue.indexOf("''")

            if (sepIdx >= 0) {
                try {
                    const encoded = starValue.slice(sepIdx + 2)
                    const normalized = encoded.replace(/\+/g, '%20')
                    return decodeURIComponent(normalized)
                } catch {
                    /* noop */
                }
            }
        }

        // filename=...
        const filename = params.get('filename')

        if (filename) return filename

        return 'unknown'
    }
}
