import { supabase } from './supabase'

const STATUS_MAX_DIM = 1024
const STATUS_MAX_VIDEO_SECONDS = 60

export function statusMediaUrl(path: string): string {
  return supabase.storage.from('status').getPublicUrl(path).data.publicUrl
}

export function resizeStatusImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width <= STATUS_MAX_DIM && height <= STATUS_MAX_DIM) {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
        return
      }
      const scale = STATUS_MAX_DIM / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl)
        resolve(blob || file)
      }, 'image/jpeg', 0.9)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('não deu pra abrir a imagem'))
    }
    img.src = objectUrl
  })
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('não deu pra ler o vídeo'))
    }
    video.src = objectUrl
  })
}

export async function assertVideoWithinLimit(file: File): Promise<void> {
  const duration = await readVideoDuration(file)
  if (duration > STATUS_MAX_VIDEO_SECONDS) {
    throw new Error(`vídeo tem que ter no máximo ${STATUS_MAX_VIDEO_SECONDS} segundos`)
  }
}

export async function uploadStatusMedia(file: Blob, userId: string, ext: string): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('status').upload(path, file, { cacheControl: '3600' })
  if (error) throw error
  return path
}
