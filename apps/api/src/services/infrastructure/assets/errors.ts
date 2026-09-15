export const AssetErrors = {
    AlreadyOwned: (assetId: string) => ({
        code: 'ERR_ASSET_ALREADY_OWNED',
        message: 'The asset already belongs to another owner.',
        assetId
    }),
    UploadExpired: (assetId: string, expiresAt: Temporal.Instant) => ({
        code: 'ERR_ASSET_UPLOAD_EXPIRED',
        message: 'The upload request for this asset has expired.',
        assetId,
        expiresAt
    })
}
