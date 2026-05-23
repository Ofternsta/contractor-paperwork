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
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050505',
        }}
      >
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: 48,
            background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 200,
            fontWeight: 800,
            color: '#052e16',
          }}
        >
          L
        </div>
      </div>
    ),
    { ...size }
  )
}
