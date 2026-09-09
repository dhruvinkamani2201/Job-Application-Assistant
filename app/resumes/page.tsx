 'use client'

import { useState } from 'react'

export default function Resumes() {
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function upload() {
    if (!file || busy) return
    setBusy(true)
    setMsg('Uploading and analyzing resume...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: formData,
      })

      const contentType = response.headers.get('content-type') || ''
      const body = contentType.includes('application/json')
        ? await response.json()
        : { error: (await response.text()) || 'Server returned an empty response.' }

      if (!response.ok) {
        const stage = body?.stage ? ` [stage: ${body.stage}]` : ''
        setMsg(`${body?.error || `Upload failed (HTTP ${response.status}).`}${stage}`)
        return
      }

      setMsg(`Saved: ${body.profile?.name || file.name}`)
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container">
      <div className="nav">
        <div className="brand">Resume Management</div>
        <div className="navlinks">
          <a href="/">Analyze</a>
          <a href="/tracker">Tracker</a>
        </div>
      </div>
      <div className="card">
        <h1>Upload resume</h1>
        <p className="muted">Upload PDF or DOCX. Each file is parsed and profiled once, then reused for job matching.</p>
        <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="space" />
        <button className="btn" disabled={!file || busy} onClick={upload}>
          {busy ? 'Processing...' : 'Analyze & Save Resume'}
        </button>
        {msg && <p>{msg}</p>}
      </div>
    </main>
  )
}
