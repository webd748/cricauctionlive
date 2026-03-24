const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp'

export function detectImageMimeFromBytes(buffer: Uint8Array): SupportedImageMime | null {
    if (buffer.length >= 8 && PNG_SIGNATURE.every((value, index) => buffer[index] === value)) {
        return 'image/png'
    }

    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg'
    }

    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return 'image/webp'
    }

    return null
}

export function extensionFromMime(mime: SupportedImageMime): string {
    if (mime === 'image/png') return 'png'
    if (mime === 'image/jpeg') return 'jpg'
    return 'webp'
}
