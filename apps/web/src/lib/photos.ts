import { postJson } from './api-client'

type Upload = { assetId: string; url: string; fields: Record<string, string>; method: 'POST' }

export function photoUrl(url: string): string {
    const storage = new URL(url)
    return `/storage${storage.pathname}${storage.search}`
}

export async function uploadRegistrationPhoto(file: File): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    const hash = btoa(String.fromCharCode(...new Uint8Array(digest)))
    const upload = await postJson<Upload>('/users/photo-upload', {
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        checksum: { algorithm: 'sha256', base64: hash }
    })
    const body = new FormData()
    for (const [key, value] of Object.entries(upload.fields)) body.append(key, value)
    body.append('file', file)
    const response = await fetch(photoUrl(upload.url), { method: upload.method, body })
    if (!response.ok) throw new Error('사진 업로드에 실패했습니다. 회원가입은 진행되지 않았습니다.')
    return upload.assetId
}
