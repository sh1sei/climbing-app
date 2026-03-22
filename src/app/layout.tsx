import './globals.css'
import TabBar from '@/components/TabBar'

export const metadata = {
  title: 'カベログ',
  description: 'クライミング課題の記録・共有アプリ',
  manifest: '/manifest.json',
  themeColor: '#C9A96E',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'カベログ',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-bg">
        <main className="pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  )
}