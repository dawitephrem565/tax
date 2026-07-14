import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _ethiopic = Noto_Sans_Ethiopic({ subsets: ["ethiopic"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: 'Amis Financial',
  description: 'Professional tax reporting and information discovery platform',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased ${_ethiopic.className}`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
