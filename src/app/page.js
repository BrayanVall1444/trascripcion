'use client'

import { useState, useEffect, useRef } from 'react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [lang, setLang] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [status, setStatus] = useState(null)
  const [position, setPosition] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const liveRef = useRef()

  const API = process.env.NEXT_PUBLIC_API_URL
  const YT_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w\-?&=]+$/

  // Carga historial de localStorage
  useEffect(() => {
    const h = JSON.parse(localStorage.getItem('transcribe_history') || '[]')
    setHistory(h)
  }, [])

  // Guarda en historial
  const pushHistory = (entry) => {
    const next = [entry, ...history].slice(0, 5)
    setHistory(next)
    localStorage.setItem('transcribe_history', JSON.stringify(next))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!API) {
      setError('❌ NEXT_PUBLIC_API_URL no definida')
      return
    }
    if (!YT_REGEX.test(url)) {
      setError('❌ URL inválida: solo YouTube, shorts o youtu.be')
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const res = await fetch(`${API}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: url, language_preference: lang || null })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { task_id, position } = await res.json()
      setTaskId(task_id)
      setPosition(position)
      setStatus('pending')
      liveRef.current?.focus()
    } catch (e) {
      setError(`❌ ${e.message}`)
      setLoading(false)
    }
  }

  // Polling
  useEffect(() => {
    if (!taskId) return
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${taskId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setStatus(data.status)
        setPosition(data.position ?? null)
        liveRef.current?.focus()

        if (data.status === 'done') {
          setResult(data.result)
          pushHistory({ url, lang, date: new Date().toLocaleString(), id: taskId })
          clearInterval(iv)
          setLoading(false)
        }
        if (data.status === 'error') {
          setError('❌ Error en el proceso')
          clearInterval(iv)
          setLoading(false)
        }
      } catch (e) {
        setError(`❌ ${e.message}`)
        clearInterval(iv)
        setLoading(false)
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [taskId, API])

  const downloadTxt = (text, name) => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPdf = async (text, name) => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      const lines = doc.splitTextToSize(text, 180)
      doc.text(lines, 10, 10)
      doc.save(name)
    } catch (e) {
      setError(`❌ Error PDF: ${e.message}`)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Transcribe tu video</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">URL del video</label>
          <input
            type="url"
            className="w-full border px-2 py-1"
            value={url}
            onChange={e => setUrl(e.currentTarget.value)}
            placeholder="e.g. https://youtu.be/abc123 or https://youtube.com/shorts/xyz"
            title="Solo enlaces de YouTube / shorts / youtu.be"
            required
          />
        </div>
        <div>
          <label className="block font-medium">Idioma (opcional)</label>
          <input
            className="w-full border px-2 py-1"
            value={lang}
            onChange={e => setLang(e.currentTarget.value)}
            placeholder="es, en, pt..."
            title="Códigos ISO: es, en, pt..."
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 transition"
        >
          {loading && (
            <svg
              className="animate-spin h-5 w-5 mr-2 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}
          {loading ? 'Procesando…' : 'Enviar'}
        </button>
      </form>

      <div
        ref={liveRef}
        tabIndex={-1}
        aria-live="polite"
        className="sr-only"
      />

      {error && <p className="mt-4 text-red-600">{error}</p>}

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
          <section>
            <h2 className="text-xl font-semibold">Transcripción</h2>
            <div className="relative group">
              <pre className="bg-gray-100 p-2 overflow-auto">{result.transcription}</pre>
              <div className="absolute top-1 right-1 flex space-x-2 opacity-0 group-hover:opacity-80 transition">
                <button
                  onClick={() => navigator.clipboard.writeText(result.transcription)}
                  className="text-sm bg-white px-2 py-1 rounded shadow"
                >Copiar</button>
                <button
                  onClick={() => downloadTxt(result.transcription, 'transcripcion.txt')}
                  className="text-sm bg-white px-2 py-1 rounded shadow"
                >TXT</button>
                <button
                  onClick={() => downloadPdf(result.transcription, 'transcripcion.pdf')}
                  className="text-sm bg-white px-2 py-1 rounded shadow"
                >PDF</button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Corregido</h2>
            <div className="relative group">
              <pre className="bg-gray-100 p-2 overflow-auto">{result.corrected}</pre>
              <div className="absolute top-1 right-1 flex space-x-2 opacity-0 group-hover:opacity-80 transition">
                <button
                  onClick={() => navigator.clipboard.writeText(result.corrected)}
                  className="text-sm bg-white px-2 py-1 rounded shadow"
                >Copiar</button>
                <button
                  onClick={() => downloadTxt(result.corrected, 'corregido.txt')}
                  className="text-sm bg-white px-2 py-1 rounded shadow"
                >TXT</button>
                <button
                  onClick={() => downloadPdf(result.corrected, 'corregido.pdf')}
                  className="text-sm bg-white px-2 py-1 rounded shadow"
                >PDF</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold">Historial reciente</h3>
          <ul className="list-disc list-inside">
            {history.map((h, i) => (
              <li key={i} className="text-sm">
                <button
                  className="text-blue-600 underline"
                  onClick={() => {
                    setUrl(h.url)
                    setLang(h.lang)
                    setResult(null)
                    setTaskId(null)
                  }}
                >
                  {h.url} ({h.date})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}