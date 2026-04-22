import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'denwa - 音声チャット',
  description: 'ローカルLLM × AIVIS Speech による1秒未満音声チャット',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: '#0d1117', color: '#e6edf3' }}>
        {children}
      </body>
    </html>
  );
}
