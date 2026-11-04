"""Browser integration: python3 tests/browser_ledger.py [base URL]."""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8011/lottery/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.clock.install(time=datetime(2026,11,4,0,0,tzinfo=timezone.utc))
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url)
    page.wait_for_selector('.zone')
    page.locator('#structured').uncheck()
    assert page.locator('#save-record').is_disabled()
    page.locator('#generate').click()
    assert not page.locator('#save-record').is_disabled()
    page.locator('#record-target').fill('2026127')
    page.locator('#record-cutoff').fill('2026-11-05T20:00')
    page.locator('#save-record').click()
    assert '已保存' in page.locator('#ledger-status').inner_text()
    assert '1期待开奖' in page.locator('#ledger-summary').inner_text()
    raw=page.evaluate("localStorage.getItem('ssq-ledger-v1')")
    records=json.loads(raw)
    assert len(records)==1 and records[0]['cost']==160
    page.locator('#generate').click()
    page.locator('#save-record').click()
    assert '该期已有记录' in page.locator('#ledger-status').inner_text()
    assert page.evaluate("localStorage.getItem('ssq-ledger-v1')")==raw
    page.reload();page.wait_for_selector('.zone')
    assert '1期待开奖' in page.locator('#ledger-summary').inner_text()
    with page.expect_download() as info:page.locator('#export-ledger').click()
    path=Path('/tmp/ssq-ledger-browser-backup.json');info.value.save_as(path)
    backup=json.loads(path.read_text());assert len(backup['records'])==1
    # Reconcile an imported draw against every expanded ticket and keep result snapshots.
    history=json.loads((root/'data/history.json').read_text())
    history['draws'].append({'issue':'26127','date':'2026-11-05','red':['01','02','03','04','05','06'],'blue':['01']})
    page.locator('#file').set_input_files({'name':'updated.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
    page.wait_for_function("document.getElementById('ledger-summary').textContent.includes('1期已核奖')")
    assert '已核奖成本160.00元' in page.locator('#ledger-summary').inner_text()
    assert page.evaluate("JSON.parse(localStorage.getItem('ssq-ledger-v1'))[0].resultDraw.issue")=='2026127'
    page.reload();page.wait_for_selector('.zone')
    assert '1期已核奖' in page.locator('#ledger-summary').inner_text()
    # Corrections become conflicts and are excluded, not silently rewritten.
    history['draws'][-1]['blue']=['02']
    page.locator('#file').set_input_files({'name':'conflicting.json','mimeType':'application/json','buffer':json.dumps(history).encode()})
    page.wait_for_function("document.getElementById('ledger-summary').textContent.includes('1期冲突')")
    assert page.evaluate("JSON.parse(localStorage.getItem('ssq-ledger-v1'))[0].resultDraw.blue")==1
    # A backup restored into a clean browser reconstructs the record and locked control.
    fresh=browser.new_context(viewport={'width':1280,'height':900})
    other=fresh.new_page();other.goto(url);other.wait_for_selector('.zone')
    other.locator('#import-ledger').set_input_files(path)
    other.wait_for_function("document.getElementById('ledger-summary').textContent.includes('1期待开奖')")
    restored=json.loads(other.evaluate("localStorage.getItem('ssq-ledger-v1')"))
    assert restored[0]['control']==records[0]['control']
    assert restored[0]['groups']==records[0]['groups']
    # Invalid backups do not replace saved data.
    other.locator('#import-ledger').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"version":1,"records":[{"id":"bad"}]}'})
    other.wait_for_function("document.getElementById('ledger-status').textContent.includes('未导入')")
    assert len(json.loads(other.evaluate("localStorage.getItem('ssq-ledger-v1')")))==1
    # Storage denial must not report a successful save.
    denied=browser.new_context()
    denied.add_init_script("Storage.prototype.setItem=function(){throw new Error('quota denied')}")
    blocked=denied.new_page();blocked.clock.install(time=datetime(2026,11,4,0,0,tzinfo=timezone.utc))
    blocked.goto(url);blocked.wait_for_selector('.zone');blocked.locator('#structured').uncheck();blocked.locator('#generate').click()
    blocked.locator('#record-target').fill('2026127');blocked.locator('#record-cutoff').fill('2026-11-05T20:00')
    blocked.locator('#save-record').click();assert '未保存' in blocked.locator('#ledger-status').inner_text()
    assert blocked.locator('.ledger-record').count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    path.unlink()
    browser.close()
    print('Ledger browser checks passed: save, locked same-budget control, duplicate rejection, reload, backup/restore, reconciliation, preserved snapshots, conflict detection, failed import preservation, storage denial, mobile width.')
