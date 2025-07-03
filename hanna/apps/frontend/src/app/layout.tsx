import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hanna - Recepcionista Virtual Impact Hub',
  description: 'Sua assistente inteligente no Impact Hub',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-hanna-dark">{children}</body>
    </html>
  )
}