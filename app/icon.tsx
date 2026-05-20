import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#171717',
          color: '#ffffff',
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        <div style={{ fontSize: 120, marginBottom: 8 }}>📋</div>
        CP
      </div>
    ),
    { ...size }
  )
}
