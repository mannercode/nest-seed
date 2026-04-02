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
        // filename*=UTF-8''...
        const star = cd.match(/filename\*\s*=\s*([^']*)''([^;]+)/i)

        if (star?.[2]) {
            try {
                const encoded = star[2].trim()
                const normalized = encoded.replace(/\+/g, '%20')
                return decodeURIComponent(normalized)
            } catch {
                /* noop */
            }
        }

        // filename="..."
        const quoted = cd.match(/filename\s*=\s*"([^"]+)"/i)

        if (quoted?.[1]) return quoted[1]

        // filename=bare
        const bare = cd.match(/filename\s*=\s*([^;]+)/i)

        if (bare?.[1]) return bare[1].trim()

        return 'unknown'
    }
}
