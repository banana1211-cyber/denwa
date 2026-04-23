/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // クリックジャッキング防止
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIMEスニッフィング防止
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // リファラー情報を最小限に
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 不要な機能を無効化
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=(self), payment=()',
          },
          // XSS対策（古いブラウザ向け）
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Content Security Policy
          // Next.js は 'unsafe-inline' / 'unsafe-eval' が必要（デフォルト動作）
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",      // Audio再生・VRM
              "connect-src 'self'",          // 外部API呼び出しは /api/* 経由
              "font-src 'self' data:",
              "worker-src 'self' blob:",     // Web Audio API
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
