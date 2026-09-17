const RULES = [
  {
    job: 'learning transfer',
    category: 'learning gap',
    intent: 'request',
    re: /(阅读(文章|短文)|背完.{0,8}(阅读|短文|听力|口语)|掌握情况|reading.{0,20}(after|vocab)|practice.{0,20}vocab)/i
  },
  {
    job: 'data portability',
    category: 'integration gap',
    intent: 'request',
    re: /(导出|导入|同步|跨设备|文件|本地文件|markdown|obsidian|logseq|\bapi\b|\bexport\b|\bimport\b|\bsync\b|local files?)/i
  },
  {
    job: 'affordable ownership',
    category: 'pricing gap',
    intent: 'pain',
    re: /(太贵|价格|订阅|买断|终身|白花.{0,4}(钱|元)|退款|subscription|too expensive|lifetime|one[- ]time|price)/i
  },
  {
    job: 'local/private workflow',
    category: 'workflow gap',
    intent: 'value',
    re: /(无需登录|不联网|本地运行|本地优先|隐私|离线|offline|local[- ]first|privacy|without cloud|no login)/i
  },
  {
    job: 'ad-free experience',
    category: 'monetization gap',
    intent: 'pain',
    re: /(广告越来越多|强制.{0,4}广告|播放广告|看广告|ad(s)?)/i
  },
  {
    job: 'reliability',
    category: 'bug/regression',
    intent: 'pain',
    re: /(闪退|崩溃|卡死|不能用|无法使用|打不开|失效|识别不了|登录不了|不能了|crash|won't open|broken|battery drain|login.{0,8}(fail|broken))/i
  },
  {
    job: 'focused workflow',
    category: 'feature request',
    intent: 'request',
    re: /(希望|要是|能不能|建议|增加|支持|最好|wish|please add|feature request)/i
  },
  {
    job: 'focused workflow',
    category: 'product value',
    intent: 'value',
    re: /(简洁|清爽|纯粹|功能.{0,4}(够用|很多)|很好用|好用|simple|clean|focused)/i
  }
];

function excerpt(review, max = 160) {
  const text = `${review.title ?? ''} ${review.body ?? ''}`.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function inferIntent(rule, review) {
  if (rule.intent === 'value' && Number(review.rating) <= 2) return 'pain';
  if (rule.intent === 'pain' && Number(review.rating) >= 4 && /(希望|建议|要是|wish|please)/i.test(`${review.title} ${review.body}`)) return 'request';
  return rule.intent;
}

export function extractReviewSignals(reviews = []) {
  const out = [];
  for (const review of reviews) {
    const text = `${review.title ?? ''} ${review.body ?? ''}`;
    for (const rule of RULES) {
      if (!rule.re.test(text)) continue;
      out.push({
        storefront: review.storefront,
        app_id: review.app_id,
        review_id: review.review_id,
        rating: review.rating ?? null,
        created_at: review.created_at ?? null,
        job: rule.job,
        category: rule.category,
        intent: inferIntent(rule, review),
        evidence_excerpt: excerpt(review)
      });
    }
  }
  return out;
}
