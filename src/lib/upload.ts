const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

/**
 * 画像を指定サイズ以下に圧縮する（2MB超の場合のみ）
 * Canvas APIでJPEG品質を段階的に下げて圧縮
 */
async function compressImage(file: File): Promise<File> {
  // 2MB以下ならそのまま返す
  if (file.size <= MAX_FILE_SIZE) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      // 長辺が2400pxを超える場合はリサイズ
      const MAX_DIMENSION = 2400
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round(height * (MAX_DIMENSION / width))
          width = MAX_DIMENSION
        } else {
          width = Math.round(width * (MAX_DIMENSION / height))
          height = MAX_DIMENSION
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // 品質を段階的に下げて2MB以下を目指す
      const qualities = [0.85, 0.75, 0.65, 0.5, 0.4]
      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, 'image/jpeg', quality)
        )
        if (blob && blob.size <= MAX_FILE_SIZE) {
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
          })
          resolve(compressed)
          return
        }
      }

      // それでも超える場合は最低品質で返す
      const finalBlob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/jpeg', 0.3)
      )
      if (finalBlob) {
        resolve(new File([finalBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
        }))
      } else {
        reject(new Error('画像の圧縮に失敗しました'))
      }
    }
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * R2に画像をアップロードする（2MB超は自動圧縮）
 * @param file アップロードするファイル
 * @param folder 保存先フォルダ ('routes' | 'gyms')
 * @returns { url: string, key: string } 公開URLとR2キー
 */
export async function uploadImage(
  file: File,
  folder: 'routes' | 'gyms' = 'routes'
): Promise<{ url: string; key: string }> {
  // 2MB超なら自動圧縮
  const processedFile = await compressImage(file)

  const formData = new FormData()
  formData.append('file', processedFile)
  formData.append('folder', folder)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('画像のアップロードに失敗しました')
  }

  return res.json()
}

/**
 * R2から画像を削除する
 * @param url 画像の公開URL
 */
export async function deleteImage(url: string): Promise<void> {
  // URLからR2キーを抽出
  // https://pub-xxx.r2.dev/routes/xxx.jpg → routes/xxx.jpg
  const publicUrlBase = url.split('.r2.dev/')[1]
  if (!publicUrlBase) return

  await fetch('/api/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: publicUrlBase }),
  })
}
