"""Build a self-contained HTML that works without a local server."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
parts = [(root / name).read_text() for name in ['core.mjs','conditions.mjs','references.mjs','intervals.mjs','ledger.mjs','ledger-ui.mjs','app.mjs']]
parts = [re.sub(r'^import .*;\n', '', part, flags=re.M).replace('export ', '') for part in parts]
core = '\n'.join(parts[:-1])
app = parts[-1]
old = "const response=await fetch('./data/history.json');if(!response.ok)throw new Error('数据请求失败：'+response.status);\n  const data=await response.json();"
assert old in app
app = app.replace(old, "const data=JSON.parse(document.getElementById('embedded-history').textContent);")
data = json.dumps(json.loads((root / 'data/history.json').read_text()), ensure_ascii=False).replace('<', '\\u003c')
script = (core + '\n' + app).replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
html = html.replace('<script type="module" src="app.mjs"></script>', '<script type="application/json" id="embedded-history">' + data + '</script><script type="module">' + script + '</script>')
(root / '双色球缺区观察.html').write_text(html)
print('Built self-contained HTML')
