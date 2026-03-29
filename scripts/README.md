# Google Apps Script לעדכון `data/news.json`

הקובץ `news_agent.gs` מותאם למבנה החדש של `data/news.json`:

- `site`
- `updatedAt`
- `total`
- `bulletins`
- `mainHeadline`
- `secondaryHeadlines`
- `articles`

## התקנה מהירה

1. פתח פרויקט חדש ב־[Google Apps Script](https://script.google.com/).
2. צור קובץ Script חדש והדבק את התוכן של `scripts/news_agent.gs`.
3. הוסף Script Property בשם `GITHUB_TOKEN` עם Personal Access Token של GitHub.
4. עדכן ב־`CONFIG` אם צריך:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH`
   - `GITHUB_FILE_PATH`
   - `RSS_FEEDS`
5. הרץ פעם ראשונה את `testRun()` כדי לאשר הרשאות.
6. להפעלה אוטומטית:
   - `createTenMinuteTrigger()` (כל 10 דקות), או
   - `createFifteenMinuteTrigger()` (כל 15 דקות).

## אבטחה

- אל תשמור Token בקוד.
- אם טוקן דלף, בטל אותו מיד ב־GitHub והנפק חדש.
