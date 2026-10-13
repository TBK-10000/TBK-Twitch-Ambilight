# TBK Twitch Ambilight 3.0.5

An extension for Opera GX that adds dynamic ambient lighting around Twitch videos, chat styling, and readable pop-up panels. Version 3.0.5 fixes the background and title contrast of sidebar channel previews. Previews use the shared window settings; select matte or refracting glass for a translucent background. Drops and pinned messages retain the chat's colour and effects over an opaque base. The Russian instructions are in README-RU.md.

## Installation and updates

1. Download the ZIP for your browser and extract it to a permanent folder.
2. Open opera://extensions, enable **Developer mode**, and click **Load unpacked**.
3. Select the **TBK-Twitch-Ambilight** folder containing manifest.json.
4. Open Twitch and play a video. An ON/OFF switch and the TBK settings button will appear in the player.

Before updating, export your settings from the TBK menu. Replace the files in the existing folder, reload the extension on the extensions page, and reopen Twitch. Settings from 2.2.7 migrate automatically. When installing from a different folder, disable the old copy and import your saved settings. To transfer settings between browsers, use export and import; each browser stores its settings separately. No Node.js or build tools are needed for installation.

## Controls and effects

The ON/OFF switch fully disables video, chat, and window effects, restoring Twitch styling. Your settings are retained and the settings button remains available. Settings are grouped into collapsible sections. The extension's settings labels are currently in Russian.

Six effects are available: classic, soft glow, directional glow, color flow, light rays, and waves. Shader effects require WebGL; Canvas 2D uses the classic effect with an explanation in diagnostics. A separate motion slider controls animation speed: zero stops the animation while the colors continue to follow the video.

You can adjust color, brightness, blur, spread, layers, smoothing, frame rate, black bar detection, and video inset. The soft transition acts outside the image and keeps the video sharp. Normal, theater, and fullscreen modes have separate settings.

Chat styling can be enabled separately. Chat and its header carousel share a background; ordinary text follows its contrast while colored labels and accents are retained. Pop-up panels, announcements, user cards, menus, and the viewer list have readable standard, frosted glass, and refractive glass styles. Text and controls stay sharp.

## Economy mode and presets

Economy mode uses a light preset and restores your previous settings when disabled. Changing an ordinary parameter exits economy mode. Its preset can be edited separately or reset to its defaults.

Up to 32 named presets can be added, renamed, deleted, activated, copied, and pasted. Adding a preset copies your current settings. Changes are saved to the active preset automatically. Presets include normal, theater, and fullscreen settings. Copying and pasting transfers parameters while keeping the destination preset's identity and name. Settings can also be exported and imported.

## Scope

The extension supports Twitch video pages, theater and fullscreen modes, and embedded players. Availability of VOD playback depends on the channel and your Twitch access. Some sources, including certain clips, block video frame access; lighting may be unavailable for them. Creator Dashboard and pop-out chat are excluded. The picture-in-picture option controls lighting on the original page; the floating PiP window is unchanged.

If lighting is unavailable, check ON/OFF and site access, select Canvas 2D if needed, or use the retry and diagnostics controls in the TBK menu. A frame-access warning indicates a source or browser restriction.

## License

MIT, Copyright (c) 2026 TheBigKotovski (TBK). See LICENSE and THIRD-PARTY-NOTICES.md for the preserved third-party attribution.
