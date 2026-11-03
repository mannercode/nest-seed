export const RegistrationErrors = {
    PhotoIncomplete: (assetId: string) => ({
        code: 'ERR_REGISTRATION_PHOTO_INCOMPLETE',
        message: 'Photo upload is not complete.',
        assetId
    })
}
