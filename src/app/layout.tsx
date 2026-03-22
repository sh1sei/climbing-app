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
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-bg">
        <div style={{position:'fixed',top:0,left:0,zIndex:9999,background:'red',color:'white',fontSize:'20px',padding:'4px 8px'}} id="dbg"></div>
        <script dangerouslySetInnerHTML={{__html:`
          function u(){
            var wide=[];
            document.querySelectorAll('*').forEach(function(el){
              if(el.scrollWidth>400){
                var id=el.id?'#'+el.id:'';
                var cls=el.className?'.'+String(el.className).split(' ').slice(0,2).join('.'):'';
                wide.push(el.tagName+id+cls+':'+el.scrollWidth+'px')
              }
            });
            document.getElementById('dbg').textContent='VP:'+window.innerWidth+'px | total:'+wide.length+' | '+wide.join(' | ');
          }
          u();setTimeout(u,3000);setTimeout(u,6000);
        `}}/>
        <main className="pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  )
}