import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Nunito as Font } from 'next/font/google';

const font = Font({
    subsets: ['latin'],
    weight: "400",
    style: 'normal',
    display: 'swap',
    preload: true,
});

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
          <style jsx global>{`
            html {
              font-family: ${font.style.fontFamily};
            }
          `}</style>
          <Component {...pageProps} />
        </>
      );
}
