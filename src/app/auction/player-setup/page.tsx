'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { ClientOnly } from '@/components/ClientOnly'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { deleteJson, postJson } from '@/lib/apiClient'
import { getErrorMessage } from '@/lib/errors'
import { normalizePhotoUrl } from '@/lib/photoUrl'

interface Player { id: string; name: string; role: string; place: string | null; photo_url: string | null; created_at: string }
interface FormState { name: string; role: string; place: string; photo_url: string }

const defaultForm: FormState = { name: '', role: 'Batsman', place: '', photo_url: '' }

const INPUT = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm'
const SELECT = "w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm appearance-none"

type CsvPlayerRow = {
    player_name?: string
    name?: string
    role?: string
    place?: string
    photo?: string
    photo_url?: string
    image?: string
}

export default function PlayerSetupPage() {
    return (
        <ClientOnly fallback={
            <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PlayerSetupContent />
        </ClientOnly>
    )
}

function PlayerSetupContent() {
    const [form, setForm] = useState<FormState>(defaultForm)
    const [players, setPlayers] = useState<Player[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => {
        loadPlayers()
    }, [])

    const loadPlayers = async () => {
        try {
            const { data, error } = await supabase.from('players').select('*').order('created_at', { ascending: false })
            if (error) throw error
            setPlayers((data ?? []).map((player) => ({
                ...player,
                photo_url: normalizePhotoUrl(player.photo_url),
            })))
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to load players'))
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError(null); setSuccess(null)

        if (!form.name || !form.role) {
            setError('Name and Role are required')
            setSaving(false)
            return
        }

        try {
            await postJson<{ data: unknown }>('/api/players', {
                players: [{
                    name: form.name.trim(),
                    role: form.role,
                    place: form.place.trim() || null,
                    photo_url: normalizePhotoUrl(form.photo_url),
                }],
            })

            setForm(defaultForm)
            setSuccess('Player added successfully!')
            setTimeout(() => setSuccess(null), 3000)
            await loadPlayers()
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to add player'))
        } finally {
            setSaving(false)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setSaving(true)
        setError(null)
        setSuccess(null)

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim().toLowerCase(),
            complete: async (results) => {
                const rows = results.data as CsvPlayerRow[]
                const newPlayers = rows.map(r => ({
                    name: r.player_name?.trim() || r.name?.trim() || 'Unknown',
                    role: r.role?.trim() || 'Batsman',
                    place: r.place?.trim() || null,
                    photo_url: normalizePhotoUrl(r.photo || r.photo_url || r.image)
                })).filter(p => p.name !== 'Unknown')

                if (newPlayers.length === 0) {
                    setError('No valid players found in CSV. Ensure header columns: player_name, role, place, photo')
                    setSaving(false)
                    return
                }

                try {
                    await postJson<{ data: unknown }>('/api/players', { players: newPlayers })

                    setSuccess(`Successfully imported ${newPlayers.length} players!`)
                    setTimeout(() => setSuccess(null), 3000)
                    await loadPlayers()
                } catch (error) {
                    setError(getErrorMessage(error, 'Failed to import players'))
                } finally {
                    setSaving(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                }
            },
            error: (err) => {
                setError('CSV Parsing Error: ' + err.message)
                setSaving(false)
            }
        })
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteJson<{ data: { ok: boolean } }>(`/api/players?id=${encodeURIComponent(id)}`)
            setPlayers(players.filter(p => p.id !== id))
        } catch (error) {
            setError(getErrorMessage(error, 'Failed to delete player'))
        }
    }

    const formatINR = (val: number) => `₹${val.toLocaleString('en-IN')}`

    void formatINR

    if (loading) return (
        <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-[#f1f5f9] p-6 pb-20">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="mb-8 text-center pt-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 border border-indigo-200 rounded-2xl mb-4 shadow-sm">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Player Setup</h1>
                    <p className="mt-2 text-slate-500">Upload CSV or manually add players for the auction pool</p>
                </div>

                {/* Progress */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <a href="/auction/auction-setup" className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200">✓</a>
                        <span className="text-slate-600">Settings</span>
                        <div className="w-8 h-0.5 bg-indigo-500 mx-2"/>
                        <a href="/auction/team-setup" className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200">✓</a>
                        <span className="text-slate-600">Teams</span>
                        <div className="w-8 h-0.5 bg-indigo-500 mx-2"/>
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">3</span>
                        <span className="text-indigo-600">Players</span>
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
                {success && (
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm shadow-sm mb-6">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>{success}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add / Import Area */}
                    <div className="md:col-span-1 space-y-6">
                        {/* CSV Import */}
                        <div className="border border-slate-200 bg-white rounded-2xl p-5 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-800 mb-2">Import from CSV</h2>
                            <p className="text-xs text-slate-500 mb-3">Required headers: player_name, role, place, photo</p>
                            
                            <a href="/sample_players.csv" download className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors mb-4">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download Sample CSV
                            </a>

                            <label className="flex items-center justify-center w-full min-h-[100px] border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer transition-colors">
                                <span className="text-sm font-semibold text-indigo-600 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Select CSV File
                                </span>
                                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} ref={fileInputRef} disabled={saving} />
                            </label>
                        </div>

                        {/* Manual Form */}
                        <div className="border border-slate-200 bg-white rounded-2xl p-5 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">Add Manually</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Player Name</label>
                                    <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Virat Kohli" className={INPUT} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Role</label>
                                    <div className="relative">
                                        <select required value={form.role} onChange={e => setForm({...form, role: e.target.value})} className={SELECT}>
                                            <option value="Batsman">Batsman</option>
                                            <option value="Bowler">Bowler</option>
                                            <option value="All-Rounder">All-Rounder</option>
                                            <option value="Wicket-Keeper">Wicket-Keeper</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Place / Region</label>
                                    <input type="text" value={form.place} onChange={e => setForm({...form, place: e.target.value})} placeholder="e.g. Delhi" className={INPUT} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Photo URL (Optional)</label>
                                    <input type="url" value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})} placeholder="https://..." className={INPUT} />
                                </div>
                                <button type="submit" disabled={saving} className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-70">
                                    {saving ? 'Saving...' : 'Add Player'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* List Area */}
                    <div className="md:col-span-2 border border-slate-200 bg-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800">Player Pool <span className="text-slate-400 font-normal ml-1">({players.length})</span></h2>
                        </div>
                        
                        {players.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-slate-400 text-sm">No players added to the auction yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {players.map(player => (
                                    <div key={player.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 group relative">
                                        <div className="w-12 h-12 bg-slate-200 rounded-full border-2 border-white shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center">
                                            {player.photo_url ? (
                                                <Image
                                                    src={normalizePhotoUrl(player.photo_url) ?? player.photo_url}
                                                    alt={player.name}
                                                    width={48}
                                                    height={48}
                                                    className="w-full h-full object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-800 truncate">{player.name}</p>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase">{player.role}</p>
                                            <p className="text-[11px] text-slate-500 font-semibold">{player.place || 'Unknown Place'}</p>
                                        </div>
                                        <button onClick={() => handleDelete(player.id)} className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100" title="Delete Player">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer nav */}
                <div className="mt-8 flex flex-col md:flex-row items-center justify-between border-t border-slate-200 pt-6 gap-4">
                    <a href="/auction/team-setup" className="px-6 py-2.5 text-slate-500 hover:bg-slate-200 bg-slate-100 rounded-xl text-sm font-semibold transition-all w-full md:w-auto text-center">
                        ← Back to Teams
                    </a>
                    
                    <button onClick={() => router.push('/dashboard/admin')} className="w-full md:w-auto px-8 py-3.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgb(0,0,0,0.39)] transition-all flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Finish & Go to Dashboard
                    </button>
                </div>

            </div>
        </div>
    )
}
