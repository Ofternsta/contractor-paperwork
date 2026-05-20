export async function takeNativePhoto(): Promise<File | null> {
  const { Capacitor } = await import('@capacitor/core')

  if (!Capacitor.isNativePlatform()) {
    return null
  }

  const { Camera, CameraResultType, CameraSource } = await import(
    '@capacitor/camera'
  )

  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  })

  if (!photo.webPath) return null

  const response = await fetch(photo.webPath)
  const blob = await response.blob()
  const extension = photo.format === 'png' ? 'png' : 'jpg'
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg'

  return new File([blob], `photo-${Date.now()}.${extension}`, { type: mime })
}

export async function isNativeApp(): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core')
  return Capacitor.isNativePlatform()
}
