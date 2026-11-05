"""Reference chart/table integration test; needs repository server on 8011."""
import sys,json,csv,io
from pathlib import Path
from playwright.sync_api import sync_playwright
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8011/lottery/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_selector('#reference-chart svg')
    assert '35个完整百期区间＋末尾23期' in page.locator('#reference-meta').inner_text()
    assert page.locator('#reference-summary tr').count()==3
    assert '7.66%' in page.locator('#reference-summary').inner_text()
    assert page.locator('#reference-rows tr').count()==36
    assert '23期（不足100）' in page.locator('#reference-rows tr').last.inner_text()
    page.locator('#reference-chart g[role=button]').first.click()
    assert '2003001—2004011' in page.locator('#reference-selected').inner_text()
    assert page.locator('#reference-rows tr.selected-reference').count()==1
    with page.expect_download() as info:page.locator('#reference-csv').click()
    out=Path('/tmp/ssq-reference-browser.csv');info.value.save_as(out)
    rows=list(csv.DictReader(io.StringIO(out.read_text(encoding='utf-8-sig'))))
    assert len(rows)==36 and rows[-1]['样本期数']=='23';out.unlink()
    with page.expect_download() as info:page.locator('#reference-svg').click()
    out=Path('/tmp/ssq-reference-browser.svg');info.value.save_as(out)
    from xml.etree import ElementTree
    root=ElementTree.fromstring(out.read_text());assert root.tag.endswith('svg');out.unlink()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    # Entire-history replacement recomputes references rather than showing stale snapshot figures.
    history=json.loads((Path(__file__).resolve().parents[1]/'data/history.json').read_text())
    history['draws']=sorted(history['draws'],key=lambda d:d['date'])[:200]
    page.locator('#file').set_input_files({'name':'short.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
    page.wait_for_function("document.getElementById('reference-rows').children.length===2")
    assert '共200期；2个完整百期区间' in page.locator('#reference-meta').inner_text()
    assert not errors,errors
    browser.close()
    print('Reference browser checks passed: mobile layout, 36 blocks, partial denominator, point details, CSV/SVG export, recomputation after import.')
