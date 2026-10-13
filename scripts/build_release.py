"""Build deterministic installation archives using Python's standard library."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ('manifest.json', 'style.css', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'README-RU.md', 'README-EN.md')
FOLDERS = ('src', 'icons', 'LICENSES')
BROWSERS = {'chrome': 'Google Chrome', 'opera-gx': 'Opera GX'}
EMAIL = re.compile(rb'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
LOCAL_PATH = re.compile(rb'(?<![A-Za-z0-9])(?:[A-Za-z]:[\\/]|/(?:Users|home)/[^/\s]+/)', re.I)

def check_content(name, data):
    if name.endswith('.png'):
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Invalid PNG: ' + name)
        offset = 8
        while offset < len(data):
            size = int.from_bytes(data[offset:offset + 4], 'big')
            kind = data[offset + 4:offset + 8]
            if kind in (b'tEXt', b'zTXt', b'iTXt', b'eXIf', b'tIME'):
                raise ValueError('Embedded image metadata: ' + name)
            offset += size + 12
        if offset != len(data):
            raise ValueError('Invalid PNG structure: ' + name)
    else:
        emails = EMAIL.findall(data)
        if any(email != b'noreply@github.com' and not email.endswith(b'@users.noreply.github.com') for email in emails) or LOCAL_PATH.search(data):
            raise ValueError('Email or local path in file: ' + name)

def payload(root, browser):
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8-sig'))
    version = manifest['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Expected a three-part extension version')
    paths = [root / name for name in FILES]
    for folder in FOLDERS:
        paths.extend(path for path in (root / folder).rglob('*') if path.is_file())
    entries = {}
    for path in paths:
        if path.is_symlink():
            raise ValueError('Symlink in payload')
        relative = path.relative_to(root).as_posix()
        if any(part.startswith('.') for part in path.relative_to(root).parts):
            raise ValueError('Hidden file in payload')
        data = path.read_bytes()
        check_content(relative, data)
        entries[relative] = data
    resources = list(manifest.get('icons', {}).values())
    for content_script in manifest['content_scripts']:
        resources += content_script.get('js', []) + content_script.get('css', [])
    for name in resources:
        if name not in entries:
            raise ValueError('Missing manifest resource: ' + name)
    manifest['description'] = 'Подсветка Twitch для ' + BROWSERS[browser] + ': эффекты видео, оформление чата и окон, пресеты и экономичный режим.'
    entries['manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf8')
    for name in ('README-RU.md', 'README-EN.md'):
        text = entries[name].decode('utf-8-sig')
        if browser == 'chrome':
            text = text.replace('Opera GX', 'Google Chrome').replace('opera://extensions', 'chrome://extensions')
        entries[name] = (text.rstrip() + '\n').encode('utf8')
    return version, entries

def build(root, out):
    out.mkdir(parents=True, exist_ok=True)
    result = []
    for browser in BROWSERS:
        version, entries = payload(root, browser)
        name = 'TBK-Twitch-Ambilight-v' + version + '-' + browser + '.zip'
        archive = out / name
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
            for relative, data in sorted(entries.items()):
                item = zipfile.ZipInfo('TBK-Twitch-Ambilight/' + relative, date_time=(1980, 1, 1, 0, 0, 0))
                item.compress_type = zipfile.ZIP_DEFLATED
                item.create_system = 0
                item.external_attr = 0x20
                item.extra = b''
                item.comment = b''
                target.writestr(item, data, compresslevel=9)
        with zipfile.ZipFile(archive) as target:
            assert sorted(target.namelist()) == sorted('TBK-Twitch-Ambilight/' + name for name in entries)
            assert not target.comment
            for item in target.infolist():
                assert not item.extra and not item.comment
                assert target.read(item.filename) == entries[item.filename.removeprefix('TBK-Twitch-Ambilight/')]
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        result.append({'browser': browser, 'name': name, 'sha256': digest, 'files': len(entries)})
    (out / 'SHA256SUMS.txt').write_text(''.join(item['sha256'] + '  ' + item['name'] + '\n' for item in result), encoding='utf8', newline='\n')
    print(json.dumps({'version': version, 'archives': result}, ensure_ascii=False))
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, default=ROOT)
    parser.add_argument('--out', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    build(args.source_root.resolve(), args.out.resolve())
