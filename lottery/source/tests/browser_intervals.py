"""Interval reference integration test; repository server required."""
import sys,json,csv,io
from pathlib import Path
from playwright.sync_api import sync_playwright
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8012/lottery/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_selector('#interval-chart svg')
    assert page.locator('#interval-summary tr').count()==3
    assert '12.81' in page.locator('#interval-summary tr').nth(2).inner_text()
    assert '133' in page.locator('#interval-summary tr').nth(1).inner_text()
    assert page.locator('#interval-distribution tr').count()==7
    assert '8/118＝6.78%' in page.locator('#interval-validation').inner_text()
    assert '2023126 / 2023-11-02' in page.locator('#interval-maxima').text_content()
    assert '共704个完整间隔' in page.locator('#interval-page').text_content()
    details=page.locator('details').filter(has=page.locator('#interval-zone'))
    details.locator('summary').click()
    page.locator('#interval-zone').select_option('2')
    assert '共269个完整间隔' in page.locator('#interval-page').text_content()
    assert page.locator('#interval-list tr').count()==25
    page.locator('#interval-next').click();assert '2/11页' in page.locator('#interval-page').text_content()
    with page.expect_download() as info:page.locator('#interval-export').click()
    path=Path('/tmp/ssq-intervals-browser.csv');info.value.save_as(path)
    rows=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))));path.unlink()
    assert len(rows)==704 and all(len(r['前次六红'].split())==6 for r in rows)
    with page.expect_download() as info:page.locator('#interval-export-summary').click()
    path=Path('/tmp/ssq-intervals-summary.csv');info.value.save_as(path)
    rows=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))));path.unlink()
    assert len(rows)==3 and rows[2]['当前未完成遗漏']=='42'
    with page.expect_download() as info:page.locator('#interval-export-svg').click()
    path=Path('/tmp/ssq-intervals-browser.svg');info.value.save_as(path)
    from xml.etree import ElementTree
    assert ElementTree.fromstring(path.read_text()).tag.endswith('svg');path.unlink()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    history=json.loads((Path(__file__).resolve().parents[1]/'data/history.json').read_text())
    history['draws']=sorted(history['draws'],key=lambda d:d['date'])[:1]
    page.locator('#file').set_input_files({'name':'tiny.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
    page.wait_for_function("document.getElementById('interval-meta').textContent.includes('共1期')")
    assert '训练数据不足' in page.locator('#interval-validation').inner_text()
    assert '共0个完整间隔' in page.locator('#interval-page').text_content()
    assert not errors,errors
    browser.close()
    print('Interval browser checks passed: summary/distribution, locked-threshold analysis, longest records, 704-row export, zone filtering/pagination, SVG, tiny import and mobile layout.')
