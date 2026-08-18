import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arohak Employee Skill & Details Portal',
  description:
    'Arohak Employee Portal — manage profiles, directories, attendance, schedules, certifications, and yearly skill targets.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
      </head>
      <body>
        <div className="fixed -z-10 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.12] pointer-events-none top-[-200px] left-[-100px] bg-accent-primary animate-[float_25s_infinite_alternate_ease-in-out]" />
        <div className="fixed -z-10 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.12] pointer-events-none bottom-[-200px] right-[-100px] bg-accent-secondary animate-[float_25s_infinite_alternate_ease-in-out] [animation-delay:-5s]" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
