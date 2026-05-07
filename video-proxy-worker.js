// Cloudflare Worker — 视频代理 + 防盗链
// 部署到 Cloudflare Workers 后，用户只能通过 Worker URL 访问视频
// R2 直链对用户彻底隐藏

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;  // e.g. /视频名.mp4

    // ===== 1. 校验 Referer（防盗链）=====
    const referer = request.headers.get('Referer') || '';
    const origin = request.headers.get('Origin') || '';

    const isAllowed = [...ALLOWED_DOMAINS, ...(env.EXTRA_DOMAINS || '').split(',').filter(Boolean)]
      .some(domain =>
        referer.includes(domain) || origin.includes(domain)
      );

    // 允许没有 Referer 的请求（直接浏览器打开可能无 referer）
    // 但如果请求中有 Referer 但不是我们的域名，拦截
    if (referer && !isAllowed) {
      return new Response('Forbidden', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // ===== 2. 从 R2 获取视频 =====
    const r2Url = R2_BASE_URL + path;

    try {
      const response = await fetch(r2Url);

      if (!response.ok) {
        return new Response('Video not found', { status: 404 });
      }

      // ===== 3. 构造响应 =====
      const headers = new Headers(response.headers);

      // 强制 Content-Type 为视频
      headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');

      // 添加防盗链响应头
      headers.set('X-Content-Type-Options', 'nosniff');

      // 允许跨域（网站本身有跨域需求）
      headers.set('Access-Control-Allow-Origin', '*');

      // 缓存控制：浏览器缓存 1 小时，CDN 缓存 1 天
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');

      // 移除可能暴露源头的信息
      headers.delete('CF-Ray');
      headers.delete('Server');

      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (err) {
      return new Response('Proxy error: ' + err.message, { status: 500 });
    }
  }
};
