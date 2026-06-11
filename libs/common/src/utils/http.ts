export class HttpUtil {
    static buildContentDisposition(filename: string): string {
        const asciiFallbackRaw = filename
            .trim()
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/[^\x20-\x7E]/g, '_')
        const asciiFallback = asciiFallbackRaw.length > 0 ? asciiFallbackRaw : 'file'

        // RFC 5987의 ext-value는 공백을 %20으로 둔다.
        // `+`는 평문 더하기로 해석되므로 치환하지 않는다.
        const utf8Star = encodeURIComponent(filename).replace(
            /['()*]/g,
            (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
        )

        return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Star}`
    }
}
