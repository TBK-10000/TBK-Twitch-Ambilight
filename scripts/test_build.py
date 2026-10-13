import contextlib
import io
import os
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile
from build_release import build, payload, ROOT

class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.source = self.base / 'source'
        shutil.copytree(ROOT, self.source, ignore=shutil.ignore_patterns('.git', 'dist', 'node_modules', '__pycache__', 'artifacts'))

    def tearDown(self):
        self.temp.cleanup()

    def build(self, name):
        with contextlib.redirect_stdout(io.StringIO()):
            return build(self.source, self.base / name)

    def test_archive_does_not_use_local_file_times(self):
        first = self.build('first')
        for path in self.source.rglob('*'):
            if path.is_file():
                os.utime(path, (1700000000, 1700000000))
        second = self.build('second')
        self.assertEqual(first, second)
        for item in first:
            with zipfile.ZipFile(self.base / 'first' / item['name']) as archive:
                self.assertTrue(all(entry.date_time == (1980, 1, 1, 0, 0, 0) and not entry.extra and not entry.comment for entry in archive.infolist()))

    def test_generated_files_and_test_code_are_excluded(self):
        (self.source / '.env').write_text('PRIVATE=example', encoding='utf8')
        items = self.build('safe')
        with zipfile.ZipFile(self.base / 'safe' / items[0]['name']) as archive:
            self.assertFalse(any('/developer/' in name or '/scripts/' in name or '.env' in name for name in archive.namelist()))

    def test_missing_manifest_resource_fails(self):
        (self.source / 'src/main.js').unlink()
        with self.assertRaises((ValueError, FileNotFoundError)):
            payload(self.source, 'chrome')

    def test_contact_details_in_runtime_fail(self):
        (self.source / 'src/private.js').write_text('example' + chr(64) + 'example.invalid', encoding='utf8')
        with self.assertRaises(ValueError):
            payload(self.source, 'chrome')

    def test_browser_packages_share_runtime_and_licenses(self):
        _, chrome = payload(self.source, 'chrome')
        _, opera = payload(self.source, 'opera-gx')
        for name in chrome:
            if name not in ('manifest.json', 'README-RU.md', 'README-EN.md'):
                self.assertEqual(chrome[name], opera[name])

if __name__ == '__main__':
    unittest.main()
