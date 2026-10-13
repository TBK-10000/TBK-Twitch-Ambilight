"""Check tracked source files before packaging or publishing."""
from pathlib import Path
import re
import subprocess
from build_release import ROOT, check_content

def verify(root):
    if (root / '.git').exists():
        names = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode('utf8').split('\0')
        emails = subprocess.check_output(['git', '-C', str(root), 'log', '--format=%ae%n%ce']).decode('utf8').splitlines()
        for email in emails:
            if email != 'noreply@github.com' and not email.endswith('@users.noreply.github.com'):
                raise ValueError('Non-private commit email in active history')
    else:
        names = [path.relative_to(root).as_posix() for path in root.rglob('*') if path.is_file()]
        names = [name for name in names if (not any(part in ('dist', '__pycache__', 'node_modules') or part.startswith(('profile', 'test-profile-', 'smoke-profile-')) for part in Path(name).parts) and not name.endswith(('-results.json', '.png'))) or name.startswith('icons/')]
    checked = 0
    for name in filter(None, names):
        parts = Path(name).parts
        if any(part in ('verification', 'artifacts', 'node_modules', '.env', '.git') or part.startswith(('profile', 'test-profile-', 'smoke-profile-')) for part in parts):
            raise ValueError('Private or generated file in source: ' + name)
        if name.endswith(('-results.json', 'TEST-REPORT.md')) or name == 'developer/results.json':
            raise ValueError('Test output in source: ' + name)
        if name.endswith('.json') and name not in ('manifest.json', 'developer/package.json', 'developer/package-lock.json'):
            raise ValueError('Unexpected JSON data in source: ' + name)
        path = root / name
        if path.is_symlink():
            raise ValueError('Symlink in source: ' + name)
        check_content(name, path.read_bytes())
        checked += 1
    print('Source privacy check passed: ' + str(checked) + ' files; no personal contact details, local paths, reports or embedded image metadata.')

if __name__ == '__main__':
    verify(ROOT)
