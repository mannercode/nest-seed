export const AssetErrors = {
    UploadExpired: (assetId: string, expiresAt: Date) => ({
        code: 'ERR_ASSET_UPLOAD_EXPIRED',
        message: 'The upload request for this asset has expired.',
        assetId,
        expiresAt
    })
}
