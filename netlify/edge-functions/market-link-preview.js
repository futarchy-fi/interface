// Link previews for /market?proposalId=0x…
//
// /market is one client-rendered page for every market, so its HTML carries no
// per-market Open Graph tags and chat apps (WhatsApp, Telegram, Slack, X…) show
// no preview. Each market that is listed in src/config/markets.js also has a
// static page at /markets/<address> with the right tags. When a link-preview
// crawler asks for /market?proposalId=<address>, answer with that static page.
// Everyone else, and any market without a static page, gets the normal page.

const PREVIEW_BOTS = /whatsapp|facebookexternalhit|facebot|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|skypeuripreview|iframely|embedly|pinterest|redditbot|applebot|googlebot|bingbot|mastodon|signal/i;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export default async function marketLinkPreview(request, context) {
  try {
    const url = new URL(request.url);
    const proposalId = url.searchParams.get('proposalId') || '';
    const userAgent = request.headers.get('user-agent') || '';

    if (!ADDRESS.test(proposalId) || !PREVIEW_BOTS.test(userAgent)) {
      return context.next();
    }

    const staticPage = await fetch(new URL(`/markets/${proposalId.toLowerCase()}`, url.origin), {
      headers: { 'user-agent': 'futarchy-market-link-preview' },
      redirect: 'follow',
    });
    const type = staticPage.headers.get('content-type') || '';
    if (!staticPage.ok || !type.includes('text/html')) {
      return context.next();
    }

    return new Response(staticPage.body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-futarchy-link-preview': 'static-market-page',
      },
    });
  } catch (_) {
    // Never break the market page because of previews.
    return context.next();
  }
}

export const config = {
  path: ['/market', '/market/', '/market.html'],
};
