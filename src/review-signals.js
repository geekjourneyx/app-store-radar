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
    re: /(导出|导入|跨设备.{0,8}(同步|迁移)|数据.{0,6}(同步|迁移)|iCloud.{0,8}同步|本地文件|markdown|obsidian|logseq|\bapi\b|\bexport\b|\bimport\b|data portability|local files?|sync.{0,12}(devices?|icloud))/i
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
    re: /(广告越来越多|强制.{0,4}广告|播放广告|看广告|弹窗广告|\bads?\b)/i
  },
  {
    job: 'ad-free experience',
    category: 'monetization value',
    intent: 'value',
    re: /(无广告|没有广告|不含广告|ad[- ]free|no ads)/i
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
    generic: true,
    re: /(希望.{0,16}(增加|支持|加入|提供|新增)|建议.{0,12}(增加|支持|加入|提供|新增)|能不能.{0,12}(增加|支持|加入|导出|导入)|please add|feature request|wish.{0,20}(support|add|export|import))/i
  },
  {
    job: 'focused workflow',
    category: 'product value',
    intent: 'value',
    generic: true,
    re: /(简洁|清爽|纯粹|不冗余|功能.{0,5}(够用|精简)|simple.{0,12}(workflow|interface)|clean.{0,12}(interface|workflow)|focused workflow|minimal)/i
  }
];

function excerpt(review, max = 160) {
  const text = `${review.title ?? ''} ${review.body ?? ''}`.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function inferIntent(rule, review) {
  const text = `${review.title ?? ''} ${review.body ?? ''}`;
  const rating = Number(review.rating);
  if (rule.job === 'affordable ownership' && rating >= 4 && /(买断|终身|one[- ]time|lifetime)/i.test(text)) return 'value';
  if (rule.intent === 'value' && rating <= 2) return 'pain';
  if (rule.intent === 'pain' && rating >= 4 && /(希望|建议|要是|wish|please)/i.test(text)) return 'request';
  return rule.intent;
}

export function extractReviewSignals(reviews = []) {
  const out = [];
  for (const review of reviews) {
    const text = `${review.title ?? ''} ${review.body ?? ''}`;
    const matches = RULES.filter((rule) => rule.re.test(text));
    const hasSpecific = matches.some((rule) => !rule.generic);
    const selected = hasSpecific ? matches.filter((rule) => !rule.generic) : matches;
    const seen = new Set();

    for (const rule of selected) {
      const intent = inferIntent(rule, review);
      const key = `${rule.job}:${intent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        storefront: review.storefront,
        app_id: review.app_id,
        review_id: review.review_id,
        rating: review.rating ?? null,
        created_at: review.created_at ?? null,
        job: rule.job,
        category: rule.category,
        intent,
        specificity: rule.generic ? 'generic' : 'specific',
        evidence_excerpt: excerpt(review)
      });
    }
  }
  return out;
}
