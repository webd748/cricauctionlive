import type { SupabaseClient } from '@supabase/supabase-js'
import { detectImageMimeFromBytes, extensionFromMime } from '@/lib/server/imageValidation'

type CreateTeamInput = {
    name: string
    acronym: string
    logo: File | null
}

const MAX_TEAM_LOGO_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function createTeam(client: SupabaseClient, input: CreateTeamInput) {
    const name = input.name.trim()
    const acronym = input.acronym.trim().toUpperCase()

    if (!name || !acronym) {
        throw new Error('Name and acronym are required.')
    }
    if (name.length > 80) {
        throw new Error('Team name must be 80 characters or less.')
    }
    if (!/^[A-Z0-9]{2,4}$/.test(acronym)) {
        throw new Error('Acronym must be 2-4 uppercase letters or numbers.')
    }

    let logoUrl: string | null = null
    if (input.logo instanceof File && input.logo.size > 0) {
        if (input.logo.size > MAX_TEAM_LOGO_SIZE_BYTES) {
            throw new Error('Team logo must be 2MB or less.')
        }
        if (!ALLOWED_IMAGE_TYPES.has(input.logo.type)) {
            throw new Error('Team logo must be PNG, JPG, or WEBP.')
        }

        const fileBuffer = Buffer.from(await input.logo.arrayBuffer())
        const detectedType = detectImageMimeFromBytes(fileBuffer)
        if (!detectedType || !ALLOWED_IMAGE_TYPES.has(detectedType)) {
            throw new Error('Team logo content is invalid. Upload a valid PNG, JPG, or WEBP image.')
        }
        if (input.logo.type && input.logo.type !== detectedType) {
            throw new Error('Team logo type does not match file content.')
        }

        const extension = extensionFromMime(detectedType)
        const fileName = `${Date.now()}_${crypto.randomUUID()}.${extension}`

        const { error: uploadError } = await client.storage
            .from('team-logos')
            .upload(fileName, fileBuffer, { contentType: detectedType })

        if (uploadError) {
            throw new Error(uploadError.message)
        }

        const { data } = client.storage.from('team-logos').getPublicUrl(fileName)
        logoUrl = data.publicUrl
    }

    const { data, error } = await client
        .from('teams')
        .insert({ name, acronym, logo_url: logoUrl })
        .select('*')
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return data
}

export async function deleteTeam(client: SupabaseClient, id: string) {
    if (!id) {
        throw new Error('Team id is required.')
    }

    const { error } = await client.from('teams').delete().eq('id', id)
    if (error) {
        throw new Error(error.message)
    }

    return { ok: true }
}
