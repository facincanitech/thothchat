import { supabase } from './supabase'

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.82
const SKIP_COMPRESSION_UNDER_BYTES = 300 * 1024

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < SKIP_COMPRESSION_UNDER_BYTES) {
    return file
  }

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob || blob.size >= file.size) return file
  return blob
}

export async function uploadImage(file: File, userId: string, prefix: string): Promise<string> {
  const body = await compressImage(file)
  const ext = body === file ? '' : '.jpg'
  const path = `${userId}/${prefix}-${Date.now()}${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, body, { cacheControl: '3600' })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
