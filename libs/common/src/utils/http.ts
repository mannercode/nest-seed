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
}
