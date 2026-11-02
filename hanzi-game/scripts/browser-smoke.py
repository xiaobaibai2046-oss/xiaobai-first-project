"""Functional checks against an already-running root server. Requires playwright + Chromium."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8000/hanzi-game/'
KEY = 'ziyadao-progress-v1'
DATA = json.loads((Path(__file__).resolve().parents[1] / 'data.json').read_text())
POOL = {x['char']: x for x in DATA['books'][0]['characters']}


def ready(page):
    page.goto(URL)
    page.wait_for_selector('[data-mode="character"]')


def records(page):
    return page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}") || "{{}}").records || {{}}')


def choose(page, wrong=False):
    sound = page.locator('.big-pinyin').inner_text()
    choices = page.locator('[data-choice]')
    answer = next(i for i, text in enumerate(choices.all_text_contents()) if POOL[text.strip()]['pinyin'] == sound)
    choices.nth((answer + 1) % choices.count() if wrong else answer).click()
    assert page.locator('[data-choice]:disabled').count() == 4
    page.locator('[data-action="next"]').click()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390, 'height':844}, has_touch=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    ready(page)
    for width, height in [(320,740), (390,844), (768,1024), (1024,768)]:
        page.set_viewport_size({'width':width, 'height':height})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), width
        assert page.locator('[data-grade]').count() == 6
        for grade in range(1, 7):
            page.locator(f'[data-grade="{grade}"]').click()
            assert f'{"一二三四五六"[grade - 1]}年级' in page.locator('#coverage').inner_text()
        page.locator('[data-grade="1"]').click()
    print('PASS 320/390/768/1024 layouts and all six grades')

    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-grade="6"]').click()
    page.select_option('#scope', 'recognize')
    assert '没有单列识字表' in page.locator('#content').inner_text()
    page.locator('[data-action="all-scope"]').click()
    page.locator('[data-grade="1"]').click()
    page.locator('[data-term="全年"]').click()
    assert '700 个不同汉字' in page.locator('#coverage').inner_text()
    page.locator('[data-term="上"]').click()

    page.locator('[data-mode="learn"]').click()
    assert page.locator('.reveal').count() == 1
    page.locator('[data-action="reveal"]').click()
    canvas = page.locator('canvas')
    initial = canvas.evaluate('(c) => c.toDataURL()')
    box = canvas.bounding_box()
    page.mouse.move(box['x'] + 50, box['y'] + 50)
    page.mouse.down()
    page.mouse.move(box['x'] + 170, box['y'] + 170, steps=10)
    page.mouse.up()
    assert canvas.evaluate('(c) => c.toDataURL()') != initial
    page.locator('[data-action="clear-canvas"]').click()
    assert canvas.evaluate('(c) => c.toDataURL()') == initial
    page.locator('#show-ghost').uncheck()
    assert page.locator('.ghost').is_hidden()
    page.evaluate('speechSynthesis.getVoices = () => []')
    page.locator('[data-speak]').click()
    assert '普通话语音' in page.locator('#toast').inner_text()
    assert records(page) == {}, 'Learning and drawing must not award quiz points'
    page.locator('[data-action="exit"]').click()
    print('PASS flashcards, drawing/erase/ghost, and speech fallback')

    page.locator('[data-mode="character"]').click()
    choose(page, wrong=True)
    for _ in range(9):
        choose(page)
    assert '9 / 10' in page.locator('.score').inner_text()
    current = records(page)
    assert len(current) == 10
    assert sum(x['attempts'] for x in current.values()) == 10
    assert sum(x['wrong'] for x in current.values()) == 1
    page.reload()
    page.wait_for_selector('[data-mode="character"]')
    assert records(page) == current
    page.locator('[data-tab="review"]').click()
    assert page.locator('[data-card]').count() == 1
    page.locator('[data-action="review"]').click()
    choose(page)
    assert sum(x['wrong'] for x in records(page).values()) == 0
    page.locator('[data-action="exit"]').click()
    print('PASS complete ten-question round, scoring, persistence, and subsequent wrong-answer review')

    page.locator('[data-tab="cards"]').click()
    page.locator('#search').fill('天')
    assert page.locator('[data-card="天"]').count() == 1
    assert page.locator('.mini-card').count() < 36
    page.locator('[data-card="天"]').click()
    assert page.locator('#card-dialog').is_visible()
    assert 'tiān' in page.locator('#card-content').inner_text()
    page.locator('[data-close="card-dialog"]').click()
    page.locator('#parent-open').click()
    assert '并非南京教育部门发布的官方字表' in page.locator('#parent-content').inner_text()
    with page.expect_download() as download:
        page.locator('[data-action="export"]').click()
    downloaded = download.value
    backup = json.loads(Path(downloaded.path()).read_text())
    assert backup['records'] == records(page)
    before = records(page)
    page.locator('[data-action="ask-clear"]').click()
    assert records(page) == before
    page.locator('[data-action="cancel-clear"]').click()
    assert page.locator('#clear-confirm').is_hidden()
    page.locator('[data-action="ask-clear"]').click()
    page.locator('[data-action="confirm-clear"]').click()
    assert records(page) == {}
    page.locator('#parent-open').click()
    page.locator('#import-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    page.wait_for_function('!document.querySelector("#parent-dialog").open')
    assert records(page) == before
    page.locator('#parent-open').click()
    page.locator('#import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{broken'})
    page.wait_for_function('document.querySelector("#toast").textContent.includes("有效的 JSON")')
    assert records(page) == before
    page.locator('[data-close="parent-dialog"]').click()
    print('PASS card search/dialog, parent scope disclosure, backup export/import, invalid backup, confirmed reset')

    page.locator('[data-tab="play"]').click()
    page.locator('[data-mode="sound"]').click()
    assert page.locator('.sound-choice').count() == 4
    target = page.locator('.question .big-char').inner_text()
    page.get_by_role('button', name=POOL[target]['pinyin'], exact=True).click()
    assert '找到了' in page.locator('.feedback').inner_text()
    assert not errors, errors

    # Network/data failure must be recoverable instead of presenting an empty game as ready.
    other = browser.new_context(viewport={'width':320,'height':740})
    failure = other.new_page()
    failure.route('**/hanzi-game/data.json', lambda route: route.abort())
    failure.goto(URL)
    failure.wait_for_selector('#retry-load')
    failure.unroute('**/hanzi-game/data.json')
    failure.locator('#retry-load').click()
    failure.wait_for_selector('[data-mode="character"]')
    other.close()

    # Unreadable progress is never silently replaced by the next answer.
    blocked = browser.new_context()
    fault = blocked.new_page()
    fault.add_init_script(f'localStorage.setItem("{KEY}", "corrupt-original")')
    ready(fault)
    fault.locator('[data-mode="character"]').click()
    fault.locator('[data-choice]').first.click()
    assert fault.evaluate(f'localStorage.getItem("{KEY}")') == 'corrupt-original'
    blocked.close()
    print('PASS second quiz direction, data-load recovery, corrupt-storage preservation; no browser errors')

    page.locator('[data-action="exit"]').click()
    page.screenshot(path='/tmp/hanzi-game-mobile.png', full_page=True)
    page.set_viewport_size({'width':768,'height':1024})
    page.screenshot(path='/tmp/hanzi-game-tablet.png', full_page=True)
    browser.close()
