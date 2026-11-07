"""Independent fixed-triple navigation, 97-ticket plan and unified ledger."""
import json,csv,io,sys
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8015/lottery/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page.clock.install(time=datetime(2026,11,4,0,0,tzinfo=timezone.utc))
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_selector('#fixed-cost')
    page.locator('a[href="#fixed-section"]').click()
    assert page.url.endswith('#fixed-section')
    assert page.locator('#fixed-count').input_value()=='97'
    assert '共194元' in page.locator('#fixed-cost').inner_text()
    assert '10.0103%' in page.locator('#fixed-cost').inner_text() and '0.6256%' in page.locator('#fixed-cost').inner_text()
    page.locator('#fixed-generate').click()
    assert page.locator('#fixed-results .combo').count()==97
    with page.expect_download() as info:page.locator('#fixed-export').click()
    file=Path('/tmp/ssq-fixed-browser.csv');info.value.save_as(file)
    tickets=list(csv.DictReader(io.StringIO(file.read_text(encoding='utf-8-sig'))));file.unlink()
    assert len(tickets)==97 and sum(int(t['cost']) for t in tickets)==194
    reds=[tuple(int(t[f'red{i}']) for i in range(1,7)) for t in tickets]
    assert len(set(reds))==97 and all(set([10,11,12])<=set(r) and max(r)<=22 for r in reds)
    form=page.locator('details').filter(has=page.locator('#fixed-target'));form.locator('summary').click()
    page.locator('#fixed-target').fill('2026127');page.locator('#fixed-cutoff').fill('2026-11-05T20:00')
    page.locator('#fixed-save').click();assert '已保存到统一账本' in page.locator('#fixed-status').inner_text()
    record=json.loads(page.evaluate("localStorage.getItem('ssq-ledger-v1')"))[0]
    assert record['rule']['name']=='fixed-triple-hypothesis-v1' and record['cost']==194
    assert record['blues']==[int(t['blue']) for t in tickets]
    assert '独立预设：第三区缺席＋10/11/12' in page.locator('#ledger-summary').inner_text()
    page.locator('#fixed-generate').click();page.locator('#fixed-save').click()
    assert '该期已有记录' in page.locator('#fixed-status').inner_text()
    assert json.loads(page.evaluate("localStorage.getItem('ssq-ledger-v1')"))[0]==record
    history=json.loads((root/'data/history.json').read_text())
    history['draws'].append({'issue':'26127','date':'2026-11-05','red':record['groups'][0],'blue':[record['blues'][0]%16+1]})
    page.locator('#file').set_input_files({'name':'updated.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
    page.wait_for_function("document.getElementById('ledger-summary').textContent.includes('实际预设条件成立 1/1')")
    assert '一或二等奖至少命中 1/1' in page.locator('#ledger-summary').inner_text()
    assert page.locator('#fixed-save').is_disabled()
    assert page.locator('#fixed-results .combo').count()==0
    page.reload();page.wait_for_selector('#fixed-cost')
    assert '实际预设条件成立 1/1' in page.locator('#ledger-summary').inner_text()
    # No historical trigger: ordinary plan disabled, this independent hypothesis still generates.
    tiny={'draws':[json.loads((root/'data/history.json').read_text())['draws'][0]]}
    page.locator('#file').set_input_files({'name':'tiny.json','mimeType':'application/json','buffer':json.dumps(tiny).encode()})
    page.wait_for_function("document.getElementById('status').textContent.includes('1期')")
    assert page.locator('#generate').is_disabled()
    page.locator('#fixed-generate').click();assert page.locator('#fixed-results .combo').count()==97
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    # Failed hypothesis periods remain in the ledger and financial totals.
    other=browser.new_page();other.clock.install(time=datetime(2026,11,4,0,0,tzinfo=timezone.utc));other.goto(url)
    other.wait_for_selector('#fixed-cost');other.locator('#fixed-generate').click()
    other.locator('details').filter(has=other.locator('#fixed-target')).locator('summary').click()
    other.locator('#fixed-target').fill('2026127');other.locator('#fixed-cutoff').fill('2026-11-05T20:00');other.locator('#fixed-save').click()
    failed=json.loads((root/'data/history.json').read_text())
    failed['draws'].append({'issue':'26127','date':'2026-11-05','red':[1,2,3,4,5,6],'blue':[1]})
    other.locator('#file').set_input_files({'name':'failed-hypothesis.json','mimeType':'application/json','buffer':json.dumps(failed).encode()})
    other.wait_for_function("document.getElementById('ledger-summary').textContent.includes('实际预设条件成立 0/1')")
    assert '已核奖成本194.00元' in other.locator('#ledger-summary').inner_text()
    assert other.locator('.ledger-record').count()==1
    assert not errors,errors
    browser.close()
    print('Fixed-plan browser checks passed: separate navigation, 97/194 default, conditional labels, unique red/blue CSV, independent ledger, locked record, hypothesis settlement, reload, no historical trigger and mobile layout.')
