'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { ClientOnly } from '@/components/ClientOnly'
import { deleteJson } from '@/lib/apiClient'
import { getErrorMessage } from '@/lib/errors'

interface Team { id: string; name: string; acronym: string; logo_url: string | null; created_at: string }
interface FormState { name: string; acronym: string, logoFile?: File }

const defaultForm: FormState = { name: '', acronym: '' }

const INPUT = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm'

export default function TeamSetupPage() {
    return (
        <ClientOnly fallback={
            <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <TeamSetupContent />
        </ClientOnly>
    )
}

function TeamSetupContent() {
    const [form, setForm] = useState<FormState>(defaultForm)
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadTeams()
    }, [])

    const loadTeams = async () => {
        try {
            const { data, error } = await supabase.from('teams').select('*').order('created_at', { ascending: true })
            if (error) throw error
            setTeams(data || [])
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to load teams'))
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError(null)

        if (!form.name || !form.acronym) {
            setError('Name and Acronym are required')
            setSaving(false)
            return
        }

        try {
            const formData = new FormData()
            formData.append('name', form.name.trim())
            formData.append('acronym', form.acronym.trim().toUpperCase())
            if (form.logoFile) {
                formData.append('logo', form.logoFile)
            }

            const response = await fetch('/api/teams', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            })
            const payload = (await response.json().catch(() => null)) as { error?: string } | null
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to add team')
            }

            setForm(defaultForm)
            await loadTeams()
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to add team'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteJson<{ data: { ok: boolean } }>(`/api/teams?id=${encodeURIComponent(id)}`)
            setTeams(teams.filter(t => t.id !== id))
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to delete team'))
        }
    }

    if (loading) return (
        <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-[#f1f5f9] p-6 pb-20">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="mb-8 text-center pt-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 border border-indigo-200 rounded-2xl mb-4 shadow-sm">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Team Setup</h1>
                    <p className="mt-2 text-slate-500">Add the franchises participating in the auction</p>
                </div>

                {/* Progress */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <a href="/auction/auction-setup" className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200">✓</a>
                        <span className="text-slate-600">Settings</span>
                        <div className="w-8 h-0.5 bg-indigo-500 mx-2"/>
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">2</span>
                        <span className="text-indigo-600">Teams</span>
                        <div className="w-8 h-0.5 bg-slate-200 mx-2"/>
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">3</span>
                        <span className="text-slate-400">Players</span>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm shadow-sm mb-6">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>{error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Form Area */}
                    <div className="md:col-span-1 border border-slate-200 bg-white rounded-2xl p-5 shadow-sm h-fit">
                        <h2 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">Add New Team</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Team Name</label>
                                <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Chennai Super Kings" className={INPUT} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Acronym (e.g. CSK)</label>
                                <input type="text" required maxLength={4} value={form.acronym} onChange={e => setForm({...form, acronym: e.target.value})} placeholder="CSK" className={INPUT} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Team Logo (Optional)</label>
                                <div className="flex items-center gap-3">
                                    <label className="flex-1 flex items-center justify-center p-3.5 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors bg-slate-50/50 group">
                                        <svg className="w-5 h-5 text-slate-400 group-hover:text-amber-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-sm text-slate-500 font-medium truncate max-w-[150px]">
                                            {form.logoFile ? form.logoFile.name : 'Upload file...'}
                                        </span>
                                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                                            if (e.target.files?.[0]) setForm({ ...form, logoFile: e.target.files[0] })
                                        }} />
                                    </label>
                                    {form.logoFile && (
                                        <button type="button" onClick={() => setForm({ ...form, logoFile: undefined })} className="p-3.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-rose-100 bg-white">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-70">
                                {saving ? 'Adding...' : 'Add Team'}
                            </button>
                        </form>
                    </div>

                    {/* List Area */}
                    <div className="md:col-span-2 border border-slate-200 bg-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800">Added Teams <span className="text-slate-400 font-normal ml-1">({teams.length})</span></h2>
                        </div>
                        
                        {teams.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-slate-400 text-sm">No teams added yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {teams.map(team => (
                                    <div key={team.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                                {team.logo_url ? (
                                                    <Image
                                                        src={team.logo_url}
                                                        alt={team.acronym}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-contain p-1"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className="text-xs font-black text-slate-400">{team.acronym}</span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 leading-tight">{team.name}</p>
                                                <p className="text-xs text-slate-500">{team.acronym}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete(team.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete Team">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer nav */}
                <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
                    <a href="/auction/auction-setup" className="px-6 py-2.5 text-slate-500 hover:bg-slate-200 bg-slate-100 rounded-xl text-sm font-semibold transition-all">
                        ← Back to Settings
                    </a>
                    <a href="/auction/player-setup" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] transition-all flex items-center justify-center gap-2">
                        Next Step: Players
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                </div>

            </div>
        </div>
    )
}
