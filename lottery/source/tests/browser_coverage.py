"""Single-blue coverage, new ledger schema, and legacy full-blue compatibility."""
import csv,io,json,sys
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8014/lottery/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page.clock.install(time=datetime(2026,11,4,0,0,tzinfo=timezone.utc))
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_selector('.zone')
    assert page.locator('#blue-plan').input_value()=='single'
    assert page.locator('#count').input_value()=='72'
    assert not page.locator('#structured').is_checked() and not page.locator('#exclude-history').is_checked()
    assert '单期144元' in page.locator('#cost').inner_text()
    assert '0.096498%' in page.locator('#cost').inner_text() and '0.006031%' in page.locator('#cost').inner_text()
    page.locator('#generate').click();assert page.locator('.combo').count()==72
    assert page.locator('.combo .all-blue .blue').count()==72
    with page.expect_download() as info:page.locator('#export').click()
    path=Path('/tmp/ssq-coverage-tickets.csv');info.value.save_as(path)
    tickets=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))));path.unlink()
    assert len(tickets)==72 and sum(int(t['cost']) for t in tickets)==144
    assert len({tuple(t[f'red{i}'] for i in range(1,7)) for t in tickets})==72
    assert all(t['blue_plan']=='single' and 1<=int(t['blue'])<=16 for t in tickets)
    page.locator('#record-target').fill('2026127');page.locator('#record-cutoff').fill('2026-11-05T20:00')
    page.locator('#save-record').click();assert '已保存' in page.locator('#ledger-status').inner_text()
    record=json.loads(page.evaluate("localStorage.getItem('ssq-ledger-v1')"))[0]
    assert record['version']==2 and record['cost']==144 and record['blueMode']=='single'
    assert record['blues']==[int(t['blue']) for t in tickets]
    assert len(record['control'])==len(record['controlBlues'])==72
    page.locator('#generate').click()
    assert json.loads(page.evaluate("localStorage.getItem('ssq-ledger-v1')"))[0]==record
    # Restore a real legacy layout: no mode/blue fields, full-blue cost and awards retained.
    old={'version':1,'id':'01234567-89ab-4cde-8f01-23456789abcd','savedAt':'2026-11-04T00:00:00Z','cutoff':'2026-11-08T12:00:00Z','target':'2026128','targetDate':'2026-11-08','mode':'simulation','zone':2,'source':{'issue':'2026126','date':'2026-11-03','count':3523},'rule':{'name':'zone-omission-2x-v1','mean':12.81,'current':42},'groups':[[1,2,3,4,5,6]],'control':[[23,24,25,26,27,28]],'cost':32}
    page.locator('#import-ledger').set_input_files({'name':'legacy.json','mimeType':'application/json','buffer':json.dumps({'version':1,'records':[old]}).encode()})
    page.wait_for_function("document.querySelectorAll('.ledger-record').length===2")
    assert '全包16蓝' in page.locator('#ledger-summary').inner_text() and '单蓝分散覆盖' in page.locator('#ledger-summary').inner_text()
    history=json.loads((root/'data/history.json').read_text())
    wrong_blue=record['blues'][0]%16+1
    history['draws'] += [{'issue':'26127','date':'2026-11-05','red':record['groups'][0],'blue':[wrong_blue]},{'issue':'26128','date':'2026-11-08','red':[1,2,3,4,5,6],'blue':[1]}]
    page.locator('#file').set_input_files({'name':'updated.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
    page.wait_for_function("document.getElementById('ledger-summary').textContent.includes('二等奖 1 /')")
    text=page.locator('#ledger-summary').inner_text()
    assert '已核奖成本144.00元' in text and '已核奖成本32.00元' in text
    assert '二等奖 15 /' in text and '一或二等奖至少命中 1/1' in text
    saved=json.loads(page.evaluate("localStorage.getItem('ssq-ledger-v1')"))
    assert saved[0]['blues']==record['blues'] and saved[1]['version']==1 and saved[1]['cost']==32
    with page.expect_download() as info:page.locator('#export-ledger').click()
    path=Path('/tmp/ssq-coverage-backup.json');info.value.save_as(path)
    fresh=browser.new_page();fresh.goto(url);fresh.wait_for_selector('.zone');fresh.locator('#import-ledger').set_input_files(path)
    fresh.wait_for_function("document.querySelectorAll('.ledger-record').length===2")
    assert json.loads(fresh.evaluate("localStorage.getItem('ssq-ledger-v1')"))==saved
    path.unlink()
    # Plan changes clear generated tickets; legacy exports still expand 16 blues per group.
    page.locator('#blue-plan').select_option('all');assert page.locator('.combo').count()==0
    page.locator('#count').fill('5')
    # Importing the original snapshot restores its already-triggered third-zone state.
    page.locator('#file').set_input_files(root/'data/history.json');page.wait_for_function("document.getElementById('status').textContent.includes('3523期')")
    page.locator('#generate').click();assert page.locator('.combo').count()==5
    assert page.locator('.combo .all-blue .blue').count()==80
    assert '单期160元' in page.locator('#cost').inner_text()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
    print('Coverage browser checks passed: default 72/144, unique reds, 72 assigned blues/CSV, locked strategy/control, v1 backup retention, single second prize vs full-blue 1+15 prizes, backup restore, mode changes and mobile layout.')
