"""Build dist/index.html: one self-contained page (CSS and JS inlined) plus dist/examples/."""
import pathlib, shutil
root = pathlib.Path(__file__).resolve().parent
src, out = root / 'src', root / 'dist'
(out / 'examples').mkdir(parents=True, exist_ok=True)
for f in (root / 'examples').glob('*.jpg'): shutil.copy(f, out / 'examples' / f.name)
h = (src / 'index.html').read_text()
h = h.replace('__CSS__', (src / 'style.css').read_text()).replace('__CORE__', (src / 'core.js').read_text()).replace('__APP__', (src / 'app.js').read_text())
(out / 'index.html').write_text(h)
print('built dist/index.html', len(h), 'bytes')
