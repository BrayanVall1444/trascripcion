'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [lang, setLang] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [status, setStatus] = useState(null)
  const [position, setPosition] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // URL de tu FastAPI expuesta (Cloudflare Tunnel)
  const API = process.env.NEXT_PUBLIC_API_URL

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!API) {
      setError('❌ NEXT_PUBLIC_API_URL no está definida')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${API}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: url, language_preference: lang || null })
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const { task_id, position } = await res.json()
      setTaskId(task_id)
      setPosition(position)
      setStatus('pending')
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  // Polling de estado
  useEffect(() => {
    if (!taskId || !API) return
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${taskId}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        setStatus(data.status)
        setPosition(data.position ?? null)
        if (data.status === 'done') {
          setResult(data.result)
          clearInterval(iv)
          setLoading(false)
        }
        if (data.status === 'error') {
          setError('Error en el proceso, revisa logs')
          clearInterval(iv)
          setLoading(false)
        }
      } catch (e) {
        setError(e.message)
        clearInterval(iv)
        setLoading(false)
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [taskId, API])

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Transcribe tu video</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">URL del video</label>
          <input
            className="w-full border px-2 py-1"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            required
          />
        </div>
        <div>
          <label className="block font-medium">Idioma (opcional)</label>
          <input
            className="w-full border px-2 py-1"
            value={lang}
            onChange={e => setLang(e.target.value)}
            placeholder="es, en, pt..."
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Encolando…' : 'Enviar'}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-red-600">
          Error: {error}
        </p>
      )}

      {status && (
        <div className="mt-6">
          <p>🕐 Estado: <strong>{status}</strong></p>
          {position != null && status === 'pending' && (
            <p>📦 Posición en cola: {position}</p>
          )}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold">Transcripción</h2>
          <div className="relative group">
            <pre className="bg-gray-100 p-2 overflow-auto">{result.transcription}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(result.transcription)}
              className="absolute top-1 right-1 text-sm opacity-0 group-hover:opacity-80 transition"
            >
              Copiar
            </button>
          </div>

          <h2 className="text-xl font-semibold">Corregido</h2>
          <div className="relative group">
            <pre className="bg-gray-100 p-2 overflow-auto">{result.corrected}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(result.corrected)}
              className="absolute top-1 right-1 text-sm opacity-0 group-hover:opacity-80 transition"
            >
              Copiar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}