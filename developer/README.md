# Development checks / Проверки разработки

Run from this folder. Installation does not require Node or npm.

```sh
npm ci --ignore-scripts
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run test:v3
npm run test:surfaces
npm run test:chat
npm run test:chat-header
```

`unit.cjs` has 45 mocked DOM/Canvas checks; `settings-v3.cjs` has 5 settings checks. The browser scripts use a real unpacked MV3 extension or real CSS/DOM against synthetic Twitch pages. They do not establish coverage of every live Twitch page.

Use `TBK_TEST_OUTPUT` for disposable evidence/profile directories, `TBK_EXTENSION_PATH` for an extracted extension, `TBK_BROWSER_EXECUTABLE` for a supplied test browser, and `TBK_PACKAGE_REPORT` for a package installation report.

На GitHub Actions проверяются логика, настройки, CSS/пиксельные регрессии, настоящее MV3 на тестовых страницах и установка обоих ZIP. Записи запусков, снимки, профили и диагностические JSON не включаются в исходники и установочные архивы. Проверки живого Twitch и визуальная оценка выполняются отдельно.

Build ZIPs from the repository root with `python3 scripts/build_release.py`. No runtime npm dependency is bundled. Licenses and upstream attribution are retained; see the root LICENSE and THIRD-PARTY-NOTICES.md.

Version 3.0.5 adds node chat-notices.cjs (13 CSS/pixel scenarios) and node sidebar-preview.cjs (10 scenarios). They cover readable chat-style notices, hover preview glass, late native CSS, theme changes, dynamic replacement and complete cleanup.
