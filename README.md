# TBK Twitch Ambilight

**[Скачать / Download](https://github.com/TBK-10000/TBK-Twitch-Ambilight/releases/latest)** · Версия / Version **3.0.2** · Opera GX / Google Chrome · MIT

## Русский

Расширение для Opera GX и Google Chrome, которое добавляет динамическую подсветку вокруг видео на Twitch и настраиваемое оформление чата и всплывающих окон. Шесть эффектов, стеклянные стили, экономичный режим, пресеты и быстрое включение прямо в плеере.

### Возможности

- Шесть эффектов подсветки: классический, мягкое свечение, направленное свечение, растекание цвета, световые лучи и волны.
- Настройка цвета, яркости, размытия и скорости движения эффекта.
- Оформление чата и верхней карусели с общим фоном и читаемым текстом.
- Читаемые всплывающие окна с обычным оформлением, матовым стеклом или стеклом с преломлением.
- Экономичный режим с возвратом прежних настроек после выключения.
- Именованные пресеты с автосохранением, копированием и вставкой; импорт и экспорт настроек.
- Переключатель ON/OFF и кнопка настроек рядом с элементами управления плеером.
- Отдельные настройки для обычного режима, кинотеатра и полного экрана.

### Установка

1. Откройте [последний выпуск](https://github.com/TBK-10000/TBK-Twitch-Ambilight/releases/latest) и скачайте из **Assets** архив для своего браузера: **TBK-Twitch-Ambilight-v3.0.2-opera-gx.zip** или **TBK-Twitch-Ambilight-v3.0.2-chrome.zip**.
2. Распакуйте архив в постоянную папку на компьютере.
3. Откройте `opera://extensions` в Opera GX или `chrome://extensions` в Chrome и включите **Режим разработчика**.
4. Нажмите **Загрузить распакованное расширение** и выберите папку **TBK-Twitch-Ambilight**, в которой находится `manifest.json`.
5. Откройте Twitch и запустите видео. Переключатель ON/OFF и кнопка настроек появятся в плеере.

Для обновления сначала экспортируйте настройки через меню TBK. Замените файлы в прежней папке, перезагрузите расширение на странице управления расширениями и заново откройте вкладку Twitch. При установке из другой папки отключите прежнюю копию и импортируйте сохранённые настройки. Настройки между браузерами переносятся через экспорт и импорт. Интерфейс настроек расширения сейчас на русском языке.

Этот выпуск предназначен для Opera GX и Google Chrome и ручной установки. Публикация в магазинах расширений — отдельный этап. Некоторые источники видео, включая отдельные клипы, запрещают чтение кадров: для них подсветка может быть недоступна. Творческая студия и чат в отдельном окне исключены; в режиме «картинка в картинке» настраивается подсветка исходной страницы.

### Исходники и сборка

Исходники расширения находятся в корне репозитория: manifest.json, src, style.css и icons. Лицензии — LICENSE, LICENSES и THIRD-PARTY-NOTICES.md. Тестовые сценарии находятся в developer; инструкции сборки и публикации — в scripts.

Для локальной сборки достаточно Python 3.11 или новее:

```sh
python3 scripts/verify_source.py
python3 scripts/test_build.py
python3 scripts/build_release.py
```

Два установочных ZIP и SHA256SUMS.txt появятся в dist. Архивы содержат только файлы расширения, инструкции и лицензии. 

### Автоматический выпуск

Откройте [Actions → Build and release](https://github.com/TBK-10000/TBK-Twitch-Ambilight/actions/workflows/release.yml) → Run workflow. По умолчанию выполняются проверки и сборка; ZIP доступны в Artifacts запуска. Включение Publish release загружает проверенные архивы в Releases.

Для нового выпуска обновите версию manifest.json и версии в исходниках/документации, сохраните изменения и отправьте тег vX.Y.Z того же коммита. Тег должен совпадать с версией manifest.json. Отправка тега автоматически запускает проверки, сборку и публикацию обычного выпуска с архивами для Chrome и Opera GX и контрольными суммами. Повторная сборка существующей версии разрешена только на коммите её тега; описание существующего выпуска сохраняется.

## English

An extension for Opera GX and Google Chrome that adds dynamic ambient lighting around Twitch videos and customizable styling for chat and pop-up panels. Six lighting effects, glass styles, an economy mode, presets, and quick controls built into the player.

### Features

- Six lighting effects: classic, soft glow, directional glow, color flow, light rays, and waves.
- Adjustable color, brightness, blur, and effect motion speed.
- A shared background for chat and its header carousel, with readable text.
- Readable pop-up panels with standard, frosted glass, or refractive glass styling.
- An economy mode that restores your previous settings when disabled.
- Named presets with autosave, copy and paste, plus settings import and export.
- An ON/OFF switch and a settings button beside the player controls.
- Separate settings for normal, theater, and fullscreen modes.

### Installation

1. Open the [latest release](https://github.com/TBK-10000/TBK-Twitch-Ambilight/releases/latest) and download the ZIP for your browser under **Assets**: **TBK-Twitch-Ambilight-v3.0.2-opera-gx.zip** or **TBK-Twitch-Ambilight-v3.0.2-chrome.zip**.
2. Extract the archive to a permanent folder on your computer.
3. Open `opera://extensions` in Opera GX or `chrome://extensions` in Chrome and enable **Developer mode**.
4. Click **Load unpacked** and select the **TBK-Twitch-Ambilight** folder containing `manifest.json`.
5. Open Twitch and play a video. The ON/OFF switch and settings button will appear in the player.

Before updating, export your settings from the TBK menu. Replace the files in the existing folder, reload the extension on the extensions page, and reopen your Twitch tab. If installing from a different folder, disable the previous copy and import your saved settings. Use export and import to transfer settings between browsers. The extension's settings interface is currently in Russian.

This release is intended for Opera GX and Google Chrome, with manual installation. Extension store publishing is a separate stage. Some video sources, including certain clips, block frame access, so ambient lighting may be unavailable for them. Creator Dashboard and pop-out chat are excluded; the picture-in-picture option controls lighting on the original page.

### Source code and builds

The extension source is at the repository root: manifest.json, src, style.css, and icons. Licenses are in LICENSE, LICENSES, and THIRD-PARTY-NOTICES.md. Test code is in developer; build and publication scripts are in scripts.

Local packaging needs Python 3.11 or newer:

```sh
python3 scripts/verify_source.py
python3 scripts/test_build.py
python3 scripts/build_release.py
```

Two installation ZIPs and SHA256SUMS.txt are written to dist. Packages contain only extension files, instructions, and licenses. 

### Automated releases

Open [Actions → Build and release](https://github.com/TBK-10000/TBK-Twitch-Ambilight/actions/workflows/release.yml) → Run workflow. By default it tests and builds; download ZIPs from the run's Artifacts. Enable Publish release to upload the checked packages to Releases.

For a new version, update manifest.json and version references in source/docs, commit the changes, and push a matching vX.Y.Z tag on that commit. The tag must match manifest.json. A tag push automatically tests, builds, and publishes a regular release with Chrome and Opera GX ZIPs and checksums. Rebuilding an existing release requires its tag to point to the workflow's commit; the existing release description is preserved.

## Автор / Author

**TheBigKotovski (TBK)**. Distributed under the **MIT License**. The archive includes the license and third-party attribution notices.
