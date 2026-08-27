export class HttpUtil {
    static buildContentDisposition(filename: string): string {
        const asciiFallbackRaw = filename
            .trim()
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/[^\x20-\x7E]/g, '_')
        const asciiFallback = asciiFallbackRaw.length > 0 ? asciiFallbackRaw : 'file'

        // RFC 8187의 ext-value에 맞춰 UTF-8 파일명을 percent-encode한다.
        // encodeURIComponent가 남기는 '()*도 attr-char가 아니므로 추가로 인코딩한다.
        const utf8Star = encodeURIComponent(filename).replace(
            /['()*]/g,
            (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
        )

        return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Star}`
    }
}
