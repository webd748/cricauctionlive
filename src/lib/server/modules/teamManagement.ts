import type { SupabaseClient } from '@supabase/supabase-js'

type CreateTeamInput = {
    name: string
    acronym: string
    logo: File | null
}

export async function createTeam(client: SupabaseClient, input: CreateTeamInput) {
    const name = input.name.trim()
    const acronym = input.acronym.trim().toUpperCase()

    if (!name || !acronym) {
        throw new Error('Name and acronym are required.')
    }

    let logoUrl: string | null = null
    if (input.logo instanceof File && input.logo.size > 0) {
        const extension = input.logo.name.split('.').pop() ?? 'png'
        const fileName = `${Date.now()}_${crypto.randomUUID()}.${extension}`
        const fileBuffer = Buffer.from(await input.logo.arrayBuffer())

        const { error: uploadError } = await client.storage
            .from('team-logos')
            .upload(fileName, fileBuffer, { contentType: input.logo.type || 'image/png' })

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
