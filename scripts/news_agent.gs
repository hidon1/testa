const CONFIG = {
  RSS_FEEDS: [
    'https://www.ynet.co.il/Integration/StoryRss2.xml',
    'https://rss.walla.co.il/feed/1',
    'XXXXXXXXXX' // כאן תכניס RSS של ישראל היום אם יש לך
  ],

  GITHUB_OWNER: 'hidon1',
  GITHUB_REPO: 'testa',
  GITHUB_BRANCH: 'main',
  GITHUB_FILE_PATH: 'data/news.json',

  MAX_ARTICLES: 8,
  MAX_BULLETINS: 5,
  FALLBACK_IMAGE: 'https://images.unsplash.com/photo-1504711331083-9c895941bf81?q=80&w=1200&auto=format&fit=crop'
};

function getGithubToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('חסר GITHUB_TOKEN ב-Script Properties');
  }
  return token;
}

/**
 * פונקציה ראשית
 */
function runNewsAgent() {
  const rawItems = fetchAllFeeds_();
  const items = normalizeAndDedupe_(rawItems).slice(0, CONFIG.MAX_ARTICLES);

  const articles = items.map((item, index) => buildArticleObject_(item, index));

  const sortedByImportance = [...articles].sort((a, b) => {
    if ((b.importance || 0) !== (a.importance || 0)) {
      return (b.importance || 0) - (a.importance || 0);
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const mainHeadline = sortedByImportance[0] || null;
  const secondaryHeadlines = sortedByImportance.slice(1, 3);
  const bulletins = buildBulletins_(sortedByImportance.slice(0, CONFIG.MAX_BULLETINS));

  const newsJson = {
    site: {
      name: 'חדשות הציבור',
      tagline: 'חדשות חיות, פרשנות, טכנולוגיה וקהילה בזמן אמת'
    },
    updatedAt: new Date().toISOString(),
    total: articles.length,
    bulletins,
    mainHeadline,
    secondaryHeadlines,
    articles
  };

  updateGitHubJson_(CONFIG.GITHUB_FILE_PATH, newsJson);
  Logger.log('news.json עודכן בהצלחה');
}

/**
 * מושך את כל הפידים
 */
function fetchAllFeeds_() {
  let results = [];

  CONFIG.RSS_FEEDS.forEach(feedUrl => {
    if (!feedUrl || feedUrl === 'XXXXXXXXXX') return;

    try {
      const items = fetchRssFeed_(feedUrl);
      results = results.concat(items);
    } catch (err) {
      Logger.log('שגיאה בפיד: ' + feedUrl + ' | ' + err.message);
    }
  });

  return results;
}

/**
 * משיכת RSS בודד
 */
function fetchRssFeed_(rssUrl) {
  const response = UrlFetchApp.fetch(rssUrl, {
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('RSS fetch failed: ' + code);
  }

  const xmlText = response.getContentText();
  const doc = XmlService.parse(xmlText);
  const root = doc.getRootElement();

  const channel = getChildIgnoreNamespace_(root, 'channel');
  if (!channel) return [];

  const channelTitle = getChildTextIgnoreNamespace_(channel, 'title') || '';
  const items = getChildrenIgnoreNamespace_(channel, 'item');

  return items.map(item => {
    const title = getChildTextIgnoreNamespace_(item, 'title');
    const link = getChildTextIgnoreNamespace_(item, 'link');
    const pubDate = getChildTextIgnoreNamespace_(item, 'pubDate');
    const description = getChildTextIgnoreNamespace_(item, 'description');
    const creator = getChildTextIgnoreNamespace_(item, 'creator') || getChildTextIgnoreNamespace_(item, 'author');

    const imageUrl = extractImageFromItem_(item);

    return {
      title: cleanText_(title),
      link: (link || '').trim(),
      pubDate: parseDateSafe_(pubDate),
      description: cleanHtml_(description),
      rawDescription: description || '',
      imageUrl: imageUrl || '',
      sourceName: cleanText_(extractDomainName_(link) || channelTitle || 'מקור חיצוני'),
      author: cleanText_(creator || ''),
      category: guessCategory_((title || '') + ' ' + (description || '')),
      location: guessLocation_((title || '') + ' ' + (description || '')),
      tags: guessTags_((title || '') + ' ' + (description || ''))
    };
  });
}

/**
 * בונה אובייקט כתבה מלא
 */
function buildArticleObject_(item, index) {
  const title = item.title || 'ללא כותרת';
  const subtitle = buildSubtitle_(item.description);
  const summary = buildSummary_(item.description);
  const content = buildContent_(item.description, 180);
  const fullContent = buildContent_(item.description, 550);
  const category = item.category || 'חדשות';
  const importance = calculateImportance_(title, item.description, category, item.pubDate);
  const flash = buildFlash_(title);

  return {
    id: buildId_(item.link || title || ('article-' + index)),
    title,
    subtitle,
    summary,
    content,
    fullContent,
    imageUrl: item.imageUrl || CONFIG.FALLBACK_IMAGE,
    sourceUrl: item.link || '#',
    sourceName: item.sourceName || 'מקור חיצוני',
    publishedAt: item.pubDate || new Date().toISOString(),
    category,
    author: item.author || ('דסק ' + category),
    location: item.location || 'ישראל',
    readingTime: estimateReadingTime_(fullContent),
    importance,
    tags: item.tags || [],
    flash
  };
}

function buildBulletins_(items) {
  return items.slice(0, CONFIG.MAX_BULLETINS).map((item, index) => ({
    id: 'b' + (index + 1),
    priority: importanceToPriority_(item.importance || 5),
    text: buildBulletinText_(item)
  }));
}

function buildBulletinText_(item) {
  const icon = priorityToIcon_(importanceToPriority_(item.importance || 5));
  const text = item.flash || item.title || 'מבזק';
  return `${icon} ${truncateText_(text, 90)}`;
}

function importanceToPriority_(importance) {
  if (importance >= 9) return 'high';
  if (importance >= 7) return 'medium';
  return 'low';
}

function priorityToIcon_(priority) {
  if (priority === 'high') return '⚡';
  if (priority === 'medium') return '🟡';
  return '•';
}

function updateGitHubJson_(filePath, contentObject) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${filePath}`;

  const headers = {
    Authorization: 'Bearer ' + getGithubToken_(),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  let sha = null;

  const getRes = UrlFetchApp.fetch(apiUrl + '?ref=' + encodeURIComponent(CONFIG.GITHUB_BRANCH), {
    method: 'get',
    headers,
    muteHttpExceptions: true
  });

  if (getRes.getResponseCode() === 200) {
    const fileData = JSON.parse(getRes.getContentText());
    sha = fileData.sha || null;
  }

  const jsonString = JSON.stringify(contentObject, null, 2);
  const base64Content = Utilities.base64Encode(
    Utilities.newBlob(jsonString, 'application/json', 'news.json').getBytes()
  );

  const body = {
    message: 'Auto update news.json - full structure',
    content: base64Content,
    branch: CONFIG.GITHUB_BRANCH
  };

  if (sha) body.sha = sha;

  const putRes = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const code = putRes.getResponseCode();
  const text = putRes.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('GitHub update failed: ' + code + ' | ' + text);
  }

  Logger.log('GitHub updated successfully');
}

function createFifteenMinuteTrigger() {
  deleteExistingTriggers_('runNewsAgent');

  ScriptApp.newTrigger('runNewsAgent')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('נוצר trigger כל 15 דקות');
}

function createTenMinuteTrigger() {
  deleteExistingTriggers_('runNewsAgent');

  ScriptApp.newTrigger('runNewsAgent')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('נוצר trigger כל 10 דקות');
}

function deleteExistingTriggers_(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function testRun() {
  runNewsAgent();
}

function normalizeAndDedupe_(items) {
  const seen = {};
  const normalized = items
    .filter(item => item.title || item.description)
    .map(item => ({
      title: cleanText_(item.title || ''),
      link: (item.link || '').trim(),
      pubDate: item.pubDate || new Date().toISOString(),
      description: cleanText_(item.description || ''),
      rawDescription: item.rawDescription || '',
      imageUrl: item.imageUrl || '',
      sourceName: item.sourceName || '',
      author: item.author || '',
      category: item.category || '',
      location: item.location || '',
      tags: item.tags || []
    }))
    .filter(item => {
      const key = (item.link || item.title).trim().toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });

  normalized.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return normalized;
}

function extractImageFromItem_(item) {
  const enclosure = getChildIgnoreNamespace_(item, 'enclosure');
  if (enclosure && enclosure.getAttribute('url')) {
    const url = enclosure.getAttribute('url').getValue();
    if (url) return url;
  }

  const mediaContent = getChildIgnoreNamespace_(item, 'content');
  if (mediaContent && mediaContent.getAttribute('url')) {
    const url = mediaContent.getAttribute('url').getValue();
    if (url) return url;
  }

  const mediaThumb = getChildIgnoreNamespace_(item, 'thumbnail');
  if (mediaThumb && mediaThumb.getAttribute('url')) {
    const url = mediaThumb.getAttribute('url').getValue();
    if (url) return url;
  }

  return '';
}

function buildSubtitle_(text) {
  return truncateText_(cleanText_(text || ''), 120) || 'עדכון חדשותי מתפתח';
}

function buildSummary_(text) {
  return truncateText_(cleanText_(text || ''), 180) || 'אין תקציר זמין כרגע.';
}

function buildContent_(text, maxLen) {
  return truncateText_(cleanText_(text || ''), maxLen) || 'אין תוכן זמין כרגע.';
}

function buildFlash_(title) {
  return truncateText_(cleanText_(title || ''), 70) || 'מבזק מתעדכן';
}

function estimateReadingTime_(text) {
  const words = cleanText_(text || '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(2, Math.ceil(words / 90));
  return `${minutes} דקות`;
}

function calculateImportance_(title, description, category, publishedAt) {
  let score = 5;
  const text = (title + ' ' + description + ' ' + category);

  if (/חירום|מתקפה|מבצע|מעצרים|ביטחון|בריאות|הצפות|סופה|שיטפונות/.test(text)) score += 3;
  if (/כלכלה|בורסה|מיליארד|קרן השקעות/.test(text)) score += 2;
  if (/קהילה|חינוך|תרבות/.test(text)) score += 1;

  const ageHours = Math.abs(new Date().getTime() - new Date(publishedAt).getTime()) / 36e5;
  if (ageHours <= 3) score += 2;
  else if (ageHours <= 8) score += 1;

  return Math.min(10, Math.max(1, score));
}

function guessCategory_(text) {
  const t = String(text || '');

  if (/ביטחון|מעצרים|משטרה|פשיעה|חירום/.test(t)) return 'ביטחון פנים';
  if (/גשם|רוחות|סערה|הצפות|מזג האוויר|שיטפונות/.test(t)) return 'מזג אוויר';
  if (/קהילה|חוסן|הנצחה|תושבים|משפחות/.test(t)) return 'קהילה';
  if (/השקעות|בורסה|קרן|כלכלה|שוק|מיליארד/.test(t)) return 'כלכלה';
  if (/אוטובוסים|רכבת|תחבורה|רמזורים|צמתים/.test(t)) return 'תחבורה';
  if (/בתי חולים|בריאות|מיון|מטופלים|משרד הבריאות/.test(t)) return 'בריאות';
  if (/פסטיבל|תרבות|מוזיקה|אמנות/.test(t)) return 'תרבות';
  if (/חינוך|בתי ספר|מורים|תלמידים|כיתות/.test(t)) return 'חינוך';
  if (/AI|בינה מלאכותית|דיגיטל|טכנולוגיה|נתונים/.test(t)) return 'טכנולוגיה';

  return 'חדשות';
}

function guessLocation_(text) {
  const t = String(text || '');

  if (/צפון/.test(t)) return 'צפון הארץ';
  if (/חיפה/.test(t)) return 'חיפה';
  if (/תל אביב|גוש דן/.test(t)) return 'גוש דן';
  if (/ירושלים/.test(t)) return 'ירושלים';
  if (/דרום|עוטף עזה/.test(t)) return 'דרום הארץ';
  if (/חוף|מישור החוף/.test(t)) return 'מישור החוף';

  return 'ישראל';
}

function guessTags_(text) {
  const t = String(text || '');
  const tags = [];

  if (/השקעות|קרן|סטארט/.test(t)) tags.push('השקעות');
  if (/בריאות|בתי חולים|מיון/.test(t)) tags.push('בריאות');
  if (/AI|בינה מלאכותית/.test(t)) tags.push('בינה מלאכותית');
  if (/תחבורה|רכבת|אוטובוסים/.test(t)) tags.push('תחבורה');
  if (/קהילה|חוסן/.test(t)) tags.push('קהילה');
  if (/פסטיבל|מוזיקה|תרבות/.test(t)) tags.push('תרבות');
  if (/חינוך|בתי ספר/.test(t)) tags.push('חינוך');

  return Array.from(new Set(tags)).slice(0, 3);
}

function cleanText_(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function cleanHtml_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText_(text, maxLen) {
  const t = cleanText_(text);
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1).trim() + '…';
}

function parseDateSafe_(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function buildId_(text) {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9א-ת]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw || ('id-' + new Date().getTime());
}

function extractDomainName_(url) {
  try {
    const m = String(url).match(/^https?:\/\/([^\/]+)/i);
    return m ? m[1].replace(/^www\./, '') : '';
  } catch (err) {
    return '';
  }
}

function getChildIgnoreNamespace_(element, name) {
  const children = element.getChildren();
  for (let i = 0; i < children.length; i++) {
    if (children[i].getName() === name) return children[i];
  }
  return null;
}

function getChildrenIgnoreNamespace_(element, name) {
  return element.getChildren().filter(child => child.getName() === name);
}

function getChildTextIgnoreNamespace_(element, name) {
  const child = getChildIgnoreNamespace_(element, name);
  return child ? child.getText() : '';
}
