"""Verify condition controls, labelled roles, exports and saved rule snapshot."""
import json,csv,io,sys
from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8011/lottery/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page.clock.install(time=datetime(2026,11,4,0,0,tzinfo=timezone.utc))
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_selector('.zone')
    assert page.locator('#structured').is_checked()
    assert page.locator('#run-scope').input_value()=='zoneHistory'
    assert '已排除19组三连号' in page.locator('#condition-info').inner_text()
    assert page.locator('#run-evidence p').count()==19
    page.locator('#generate').click()
    assert page.locator('.combo').count()==5
    assert '共194组' in page.locator('#condition-info').inner_text()
    assert '三连号 10—11—12' in page.locator('.combo').first.inner_text()
    assert '随机号' in page.locator('.combo').first.inner_text()
    with page.expect_download() as info:page.locator('#export').click()
    path=Path('/tmp/ssq-condition-export.csv');info.value.save_as(path)
    rows=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))))
    assert len(rows)==80
    for row in rows:
        assert row['selection_rule']=='hot1-cold1-triple3-random1'
        assert [row['triple1'],row['triple2'],row['triple3']]==['10','11','12']
        roles=[row[k] for k in ['hot','cold','triple1','triple2','triple3','random']]
        assert len(set(roles))==6
        assert sorted(map(int,roles))==[int(row[f'red{i}']) for i in range(1,7)]
    path.unlink()
    page.locator('#record-target').fill('2026127');page.locator('#record-cutoff').fill('2026-11-05T20:00')
    page.locator('#save-record').click();assert '已保存' in page.locator('#ledger-status').inner_text()
    saved=json.loads(page.evaluate("localStorage.getItem('ssq-ledger-v1')"))[0]
    assert saved['selection']['runScope']=='zoneHistory'
    assert saved['selection']['roles'][0]['triple']==[10,11,12]
    assert len(saved['selection']['roles'][0]['hot'])==1
    assert '冷热三连号' in page.locator('#ledger-summary').inner_text()
    page.locator('#run-scope').select_option('all')
    assert page.locator('#generate').is_disabled()
    assert page.locator('.combo').count()==0
    assert page.locator('#save-record').is_disabled()
    assert '无法推荐' in page.locator('#condition-info').inner_text()
    page.locator('#run-scope').select_option('recent50')
    page.locator('#generate').click();assert page.locator('.combo').count()==5
    page.locator('#exact-run').uncheck();assert page.locator('.combo').count()==0
    page.locator('#generate').click();assert page.locator('.combo').count()==5
    page.locator('#structured').uncheck();assert page.locator('.combo').count()==0
    page.locator('#generate').click();assert page.locator('.combo').count()==5
    assert '随机号' not in page.locator('.combo').first.inner_text()
    page.locator('#structured').check();page.locator('#run-scope').select_option('zoneHistory');page.locator('#exact-run').check()
    page.locator('#generate').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
    print('Condition browser checks passed: strict two-zone triple exclusion, labelled 1hot+1cold+3run+1random, expanded CSV, ledger snapshot, no silent fallback, toggles and mobile layout.')
