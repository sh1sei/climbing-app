import './globals.css'
import TabBar from '@/components/TabBar'
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

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
    <html lang="ja" style={{maxWidth: '100vw', overflowX: 'hidden'}}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-bg">
        <div style={{position:'fixed',top:0,left:0,zIndex:9999,background:'red',color:'white',fontSize:'20px',padding:'4px 8px'}} id="dbg"></div>
        <script dangerouslySetInnerHTML={{__html:`
            function u(){
              document.getElementById('dbg').textContent='VP:'+window.innerWidth+'px | screen:'+screen.width+'px';
          }
          u();setInterval(u,2000);
        `}}/>
        <main className="pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  )
}