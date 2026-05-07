// Cloudflare Worker — 视频代理 + 防盗链
// 部署到 Workers，替换网站的 R2 直链

const ALLOWED_DOMAINS = [
  'www.watianmedia.cn',
  'watianmedia.cn',
  'www.watianmedia.com',
  'watianmedia.com',
  'watianmedia-website.pages.dev',
];

const R2_BASE_URL = 'https://pub-4be7bb5e88a6410eae4e8edbc0a4138b.r2.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 防盗链：校验来源
    const referer = request.headers.get('Referer') || '';
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_DOMAINS.some(d => referer.includes(d) || origin.includes(d));

    if (referer && !isAllowed) {
      return new Response('Forbidden', { status: 403 });
    }

    // 从 R2 获取视频/音频
    const r2Url = R2_BASE_URL + path;
    const response = await fetch(r2Url);
    if (!response.ok) return new Response('Not Found', { status: 404 });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(response.body, { headers });
  }
};
