import { NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase'
import { profileResume } from '@/lib/ai'
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

export const runtime = 'nodejs'

async function extractPdfText(buf: Buffer): Promise<string> {
  // unpdf uses a bundled serverless PDF.js build and does not require
  // a separate worker file, which avoids Next.js/Turbopack worker bundling issues.
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(pdf, { mergePages: true })
  await pdf.destroy()
  return typeof text === 'string' ? text : text.join('\n\n')
}

function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error')
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData()
    const file = fd.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload a PDF or DOCX file.' }, { status: 400 })
    }

    const filename = file.name
    const lowerName = filename.toLowerCase()
    const buf = Buffer.from(await file.arrayBuffer())

    let text = ''

    if (lowerName.endsWith('.pdf')) {
      text = await extractPdfText(buf)
    } else if (lowerName.endsWith('.docx')) {
      const parsed = await mammoth.extractRawText({ buffer: buf })
      text = parsed.value || ''
    } else {
      return NextResponse.json({ error: 'Only PDF and DOCX are supported.' }, { status: 400 })
    }

    if (text.trim().length < 300) {
      return NextResponse.json(
        { error: 'Could not extract enough text from this resume. The PDF may be scanned/image-only.' },
        { status: 400 }
      )
    }

    const profile = await profileResume(text, filename)
    const db = getAdminSupabase()

    const { data: users, error: usersError } = await db.auth.admin.listUsers()
    if (usersError) throw usersError

    const uid = users.users[0]?.id
    if (!uid) {
      return NextResponse.json(
        { error: 'Create your Supabase Auth user first.' },
        { status: 400 }
      )
    }

    const path = `${uid}/${crypto.randomUUID()}-${filename}`
    const { error: uploadError } = await db.storage
      .from('resumes')
      .upload(path, buf, {
        contentType:
          file.type ||
          (lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { error: dbError } = await db.from('resume_profiles').upsert(
      {
        ...profile,
        name: profile.name || filename,
        user_id: uid,
        file_path: path,
        active: true,
      },
      { onConflict: 'user_id,name' }
    )

    if (dbError) throw dbError

    return NextResponse.json({ profile }, { status: 200 })
  } catch (error) {
    console.error('Resume upload failed:', error)
    return jsonError(error, 500)
  }
}
