import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'routes'

    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`

    return NextResponse.json({ url: publicUrl, key: fileName })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json()

    if (!key) {
      return NextResponse.json({ error: 'キーがありません' }, { status: 400 })
    }

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
