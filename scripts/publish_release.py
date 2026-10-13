"""Publish only checked ZIPs and their hashes using the ephemeral Actions token."""
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def main():
    version = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8-sig'))['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Invalid extension version')
    tag = 'v' + version
    if os.environ['GITHUB_EVENT_NAME'] == 'push' and os.environ['GITHUB_REF'] != 'refs/tags/' + tag:
        raise ValueError('Tag must match manifest.json version')
    repository = os.environ['GITHUB_REPOSITORY']
    token = os.environ['GH_TOKEN']
    base = 'https://api.github.com/repos/' + repository

    def request(url, method='GET', data=None, content_type='application/json', missing=False):
        if not (url.startswith(base + '/') or url.startswith('https://uploads.github.com/repos/' + repository + '/')):
            raise ValueError('Unexpected upload destination')
        body = json.dumps(data).encode('utf8') if isinstance(data, dict) else data
        req = urllib.request.Request(url, data=body, method=method, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': content_type, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'TBK-Release'})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                content = response.read()
                return json.loads(content) if content else None
        except urllib.error.HTTPError as error:
            if missing and error.code == 404:
                return None
            raise RuntimeError('GitHub release operation failed: ' + method + ' (' + str(error.code) + ')') from None

    ref = request(base + '/git/ref/tags/' + tag)
    target = ref['object']
    while target['type'] == 'tag':
        target = request(base + '/git/tags/' + target['sha'])['object']
    if target['sha'] != os.environ['GITHUB_SHA']:
        raise ValueError('Version tag points to another commit; change the version or run the workflow at its matching tag')
    expected = ['TBK-Twitch-Ambilight-' + tag + '-chrome.zip', 'TBK-Twitch-Ambilight-' + tag + '-opera-gx.zip', 'SHA256SUMS.txt']
    if sorted(path.name for path in (ROOT / 'dist').iterdir() if path.is_file()) != sorted(expected):
        raise ValueError('Unexpected release file set')
    checksums = dict(line.split('  ', 1)[::-1] for line in (ROOT / 'dist/SHA256SUMS.txt').read_text(encoding='utf8').splitlines())
    for name in expected[:2]:
        if hashlib.sha256((ROOT / 'dist' / name).read_bytes()).hexdigest() != checksums[name]:
            raise ValueError('Archive checksum mismatch')
    release = request(base + '/releases/tags/' + tag, missing=True)
    if release is None:
        text = '## Русский\n\nTBK Twitch Ambilight ' + version + ' для Opera GX и Google Chrome. Скачайте ZIP своего браузера, распакуйте и загрузите папку TBK-Twitch-Ambilight через режим разработчика на странице расширений. Подробности и исходники — в README репозитория.\n\n## English\n\nTBK Twitch Ambilight ' + version + ' for Opera GX and Google Chrome. Download the ZIP for your browser, extract it, and load the TBK-Twitch-Ambilight folder using Developer mode on the extensions page. See the repository README for instructions and source code.'
        release = request(base + '/releases', 'POST', {'tag_name': tag, 'target_commitish': target['sha'], 'name': 'TBK Twitch Ambilight ' + version + ' — Opera GX & Chrome', 'body': text, 'draft': False, 'prerelease': False, 'make_latest': 'true'})
    if release.get('immutable'):
        raise ValueError('Release is immutable')
    existing = {item['name']: item for item in release['assets']}
    for name in expected:
        data = (ROOT / 'dist' / name).read_bytes()
        digest = 'sha256:' + hashlib.sha256(data).hexdigest()
        if name in existing and existing[name].get('digest') == digest:
            continue
        if name in existing:
            request(base + '/releases/assets/' + str(existing[name]['id']), 'DELETE')
        uploaded = request('https://uploads.github.com/repos/' + repository + '/releases/' + str(release['id']) + '/assets?name=' + urllib.parse.quote(name), 'POST', data, 'application/zip' if name.endswith('.zip') else 'text/plain')
        if uploaded.get('digest') != digest:
            raise ValueError('Uploaded asset checksum mismatch')
    print('Published ' + tag + ': Chrome ZIP, Opera GX ZIP and SHA256SUMS.txt. Existing release description preserved.')

if __name__ == '__main__':
    main()
