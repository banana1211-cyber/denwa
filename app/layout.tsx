import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'denwa - 星占い音声チャット',
  description: 'ローカルLLM × AIVIS Speech による星占い音声チャット',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
