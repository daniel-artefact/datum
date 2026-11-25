"""Build dist/shopify/datum.js: the whole app as one script that mounts itself in a shadow root, so the Shopify
theme's styles and the app's styles can't touch each other. Used by sections/datum.liquid in the theme.

The host element <datum-app> passes in:
  data-ex-tilted / data-ex-dead / data-ex-stairs   example photo URLs (same-origin /cdn/shop/files/... from image pickers)
  data-disclaimer                                  the line shown under the tool
"""
import pathlib, re, json
root = pathlib.Path(__file__).resolve().parent
src, out = root / 'src', root / 'dist' / 'shopify'
out.mkdir(parents=True, exist_ok=True)
html = (src / 'index.html').read_text()
tpl = html[html.index('<body>') + len('<body>'):html.index('<script>')].strip()
css = (src / 'style.css').read_text()
# page-level selectors become the app's own box
css = css.replace(':root {', ':host, .pf {', 1)
css = css.replace('html, body { height: 100%; margin: 0; }', ':host { display: block; } .pf { height: 100%; margin: 0; }')
css = css.replace('body { background:', '.pf { background:', 1)
css = css.replace('  html, body { height: auto; }', '  .pf { height: auto; }')
assert 'body {' not in css.replace('.pf {', ''), 'a body selector is left'
core = (src / 'core.js').read_text()
app = (src / 'app.js').read_text()
for k, f in [('tilted', 'tilted'), ('dead', 'dead-on'), ('stairs', 'stairs')]:
    a = f"src: 'examples/{f}.jpg'"
    assert app.count(a) == 1, a
    app = app.replace(a, f"src: EX.{k} || 'examples/{f}.jpg'")
js = """/* ARTEFACT DATUM (beta). Built by build_shopify.py from github.com/daniel-artefact/datum. */
(() => {
const CSS = %s;
const TPL = %s;
function run(root, host) {
  // the app was written for a whole page: give it a document that looks inside its own shadow root
  const document = {
    getElementById: id => root.getElementById(id),
    querySelector: s => root.querySelector(s),
    querySelectorAll: s => root.querySelectorAll(s),
    createElement: (...a) => window.document.createElement(...a),
  };
  const EX = { tilted: host.dataset.exTilted, dead: host.dataset.exDead, stairs: host.dataset.exStairs };
%s
%s
}
class DatumApp extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style><div class="pf">' + TPL + '</div>';
    const d = this.dataset.disclaimer, f = root.querySelector('footer');
    if (d && f) f.textContent = d;
    run(root, this);
  }
}
if (!customElements.get('datum-app')) customElements.define('datum-app', DatumApp);
})();
""" % (json.dumps(css), json.dumps(tpl), core, app)
# plain ASCII, so the file reads the same whatever charset the host serves it with (° would show as Â° otherwise)
js = ''.join(ch if ord(ch) < 128 else ''.join('\\u%04x' % u for u in __import__('struct').unpack('<' + 'H' * (len(ch.encode('utf-16-le')) // 2), ch.encode('utf-16-le'))) for ch in js)
(out / 'datum.js').write_text(js)
print('built dist/shopify/datum.js', len(js), 'bytes')
