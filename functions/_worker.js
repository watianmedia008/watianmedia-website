// Cloudflare Pages _worker.js — 视频防盗链代理
// 所有请求先进这里，视频走 R2 代理，静态文件正常返回

// ===== 配置 =====
const ALLOWED_DOMAINS = [
  'www.watianmedia.cn',
  'watianmedia.cn',
  'www.watianmedia.com',
  'watianmedia.com',
  'watianmedia-website.pages.dev',
  'localhost',
  '127.0.0.1',
];

const R2_BASE_URL = 'https://pub-4be7bb5e88a6410eae4e8edbc0a4138b.r2.dev';

// 多媒体文件扩展名
const MEDIA_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.ogg', '.flac', '.aac'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 检查是不是多媒体请求
    const isMedia = MEDIA_EXTS.some(ext => path.toLowerCase().endsWith(ext));

    if (!isMedia) {
      return env.ASSETS.fetch(request);
    }

    // ===== 视频防盗链校验 =====
    const referer = request.headers.get('Referer') || '';
    const origin = request.headers.get('Origin') || '';

    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      referer.includes(domain) || origin.includes(domain) || domain === 'localhost'
    );

    // 有 Referer 但不是我们的域名 → 拦截
    if (referer && !isAllowed) {
      return new Response('禁止外部下载', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // 直接访问（无 Referer）也允许 — 方便网站首次加载
    // (如果想完全阻止直接下载，把下面注释打开)
    // if (!referer && !origin) {
    //   return new Response('请通过官网访问', { status: 403 });
    // }

    // ===== 从 R2 获取视频 =====
    const r2Url = R2_BASE_URL + path;

    try {
      const response = await fetch(r2Url);

      if (!response.ok) {
        return new Response('视频未找到', { status: 404 });
      }

      // 构造返回
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      headers.delete('CF-Ray');
      headers.delete('Server');

      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (err) {
      return new Response('代理错误: ' + err.message, { status: 500 });
    }
  }
};
