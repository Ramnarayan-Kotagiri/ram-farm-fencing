"""Package the reviewed source and static build without caches or git metadata."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parent.parent
out = root / 'deliverables'
out.mkdir(exist_ok=True)
if not (root / 'dist' / 'index.html').is_file():
    raise SystemExit('Run the production build first.')
source_files = []
for folder in ['src', 'tests', 'public', '.github', 'scripts']:
    source_files.extend(p for p in (root / folder).rglob('*') if p.is_file())
for name in ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json',
             'vite.config.ts', 'index.html', '.gitignore', '.prettierrc.json',
             'README.md', 'VERIFICATION.md']:
    source_files.append(root / name)
with ZipFile(out / 'ram-farm-fencing-source.zip', 'w', ZIP_DEFLATED) as archive:
    for p in source_files:
        archive.write(p, str(Path('ram-farm-fencing') / p.relative_to(root)))
with ZipFile(out / 'ram-farm-fencing-site.zip', 'w', ZIP_DEFLATED) as archive:
    for p in (root / 'dist').rglob('*'):
        if p.is_file():
            archive.write(p, str(p.relative_to(root / 'dist')))
for p in sorted(out.glob('*.zip')):
    with ZipFile(p) as archive:
        assert archive.testzip() is None
        count = len(archive.infolist())
    print(p.name, count, 'files,', p.stat().st_size, 'bytes, SHA256', hashlib.sha256(p.read_bytes()).hexdigest())
