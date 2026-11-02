"""Rebuild data from locally supplied reference PDFs; never downloads textbooks.

Usage: PYTHONPATH=/tmp/hanzi-data-tools python3 scripts/extract-data.py /tmp/hanzi-textbooks
Requires PyMuPDF and pypinyin only for regeneration, not for running the app.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import fitz
from pypinyin import Style, pinyin

ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'e2b3f62213c77bb8c33c5be355f97625ea1b8b61'
TONES = dict(zip('QWASERDFUIJKT YGHO PLMVC'.replace(' ', ''), 'āáǎàēéěèīíǐìōóǒòūúǔùǚǜ'))
TONES.update(B='ǘ', N='ǖ')
HAN = r'[\u4e00-\u9fff]'
PAIR = re.compile('(' + HAN + r')\s*([a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜêɑɡ]+)(?=\s|$)')


def pronunciation(word):
    return [x[0] for x in pinyin(word, style=Style.TONE, neutral_tone_with_five=False)]


def section(doc, heading):
    start = next((i for i in range(int(len(doc) * .7), len(doc))
                  if heading in re.sub(r'\s', '', doc[i].get_text())), None)
    if start is None:
        return [], [], None
    pages, texts = [], []
    for i in range(start, len(doc)):
        text = doc[i].get_text()
        pages.append(i + 1)
        texts.append(text)
        count = re.search(r'共\s*(\d+)\s*个(?:生字|字)', text)
        if count:
            return texts, pages, int(count[1])
    raise ValueError('Table has no end: ' + heading)


def main():
    books = []
    for grade, numeral in enumerate('一二三四五六', 1):
        for term, code in [('上', 'upper'), ('下', 'lower')]:
            file = Path(sys.argv[1]) / f'g{grade}-{code}.pdf'
            doc = fitz.open(file)
            read_text, read_pages, read_expected = section(doc, '识字表') if grade < 6 else ([], [], 0)
            write_text, write_pages, write_expected = section(doc, '写字表')
            entries = {}
            def ensure(char):
                return entries.setdefault(char, dict(char=char, readings=[], recognize=False, write=False))
            blue, black = set(), set()
            for page in read_pages:
                for block in doc[page - 1].get_text('dict')['blocks']:
                    for line in block.get('lines', []):
                        for span in line['spans']:
                            color = span['color']; r, g, b = color >> 16, (color >> 8) & 255, color & 255
                            target = blue if b > r + 40 and g > r + 40 else black
                            token = re.sub(r'[\s\d]', '', span['text'])
                            if re.fullmatch(HAN, token):
                                target.add(token)
            for text in read_text:
                for char, raw in PAIR.findall(text):
                    sound = ''.join(TONES.get(c, c) for c in raw).replace('ɑ', 'a').replace('ɡ', 'g')
                    e = ensure(char)
                    e['recognize'] = True
                    if sound not in e['readings']:
                        e['readings'].append(sound)
            for text in write_text:
                for line in text.splitlines():
                    line = re.sub(r'\s', '', line)
                    if not line or any(x in line for x in ['写字表', '识字', '课文', '语文园地', '统编版', '（共']):
                        continue
                    # Numbered lesson rows in later books; single characters with pinyin in early books.
                    for char in re.findall(HAN, line):
                        ensure(char)['write'] = True
            assert sum(e['write'] for e in entries.values()) == write_expected, (file.name, 'write', sum(e['write'] for e in entries.values()), write_expected)
            if grade < 6:
                assert len({e['char'] for e in entries.values() if e['recognize']} - (blue - black)) == read_expected, (file.name, 'read', sum(e['recognize'] for e in entries.values()), read_expected, blue - black)
                for char in blue - black:
                    if char in entries:
                        entries[char]['supplementaryReading'] = True
            # Word-table examples, when present. These are short vocabulary items, not textbook prose.
            words = []
            word_start = next((i for i in range(int(len(doc) * .7), len(doc)) if re.search(r'(?m)^\s*词\s*语\s*表\s*$', doc[i].get_text())), None)
            if word_start is not None:
                for i in range(word_start, len(doc)):
                    t = doc[i].get_text()
                    if '后' in t and '记' in t and i > word_start and '联系方式' in t:
                        break
                    for word in re.findall('(?<!' + HAN + ')' + HAN + '{2,4}(?!' + HAN + ')', t):
                        if word not in ['语文园地', '统编版', '词语', '课文', '识字']:
                            words.append(word)
            common = '天地 你好 我们 他们 一天 二月 三个 四季 五个 上山 下山 口水 耳朵 目光 双手 手足 站立 坐下 日子 月亮 水果 火山 山石 石头 田地 禾苗 对面 白云 下雨 大风 花朵 小鸟 昆虫 六个 七天 八个 九月 十分 文字 数学 音乐 爸爸 妈妈 白马 土地 不同 画画 打开 下棋 小鸡 汉字 词语 语文 句子 桌子 白纸 小妹 奶奶 小桥 台风 白雪 儿子 白色 小草 家人 是的 汽车 马路 灯光 走路 秋天 天气 树叶 一片 大小 飞鸟 开会 两个 头发 里面 看见 闪光 星空 江水 南方 可以 采花 莲花 小鱼 东方 西方 北方 笔尖 说话 春天 青蛙 夏天 弯腰 皮球 冬天 男生 女生 开门 关门 正反 远方 有人 颜色 远近 听见 无声 回去 还有 来回 多少 黄牛 小猫 旁边 鸭子 苹果 杏花 桃子 书包 尺子 作业 本子 铅笔 小刀 课本 早晨 学校 明天 力气 灰尘 从前 众人 双手 木头 树林 森林 一条 开心 升起 中国 国旗 红色 唱歌 美丽 立正 中午 晚上 昨天 今天 一年 影子 前后 黑色 小狗 左右 它们 好友 朋友 比较 尾巴 谁的 长短 一把 雨伞 兔子 最好 公园 写字 诗人 一点 不要 过去 送给 当天 一串 成长 彩色 一半 天空 问好 到达 方向 没有 更好 绿色 出门 睡觉 那个 大海 认真 老师 同学 什么 才能 时间 时候 觉得 自己 很多 穿衣 衣服 快乐 又来 笑脸 看着 向前 和气 贝壳 娃娃 挂面 生活 金色 哥哥 姐姐 弟弟 叔叔 爷爷 一群 竹子 牙齿 用心 几个 跑步 为了 参加 山洞 乌鸦 住处 找到 办法 旁边 许多 放学 进来 高山 住下 孩子 玩具 发芽 爬山 很久 全部 变化 工人 工厂 医生 医院 学生' .split()
            for e in entries.values():
                for word in words + common:
                    if e['char'] in word:
                        sounds = pronunciation(word)
                        sound = sounds[word.index(e['char'])]
                        if not e['readings'] or sound in e['readings']:
                            e.update(word=word, wordPinyin=' '.join(sounds), pinyin=sound, wordSource='教材词语表' if word in words else '常用组词（自编）')
                            break
                if not e.get('pinyin'):
                    sound = pronunciation(e['char'])[0]
                    e['pinyin'] = sound if not e['readings'] or sound in e['readings'] else e['readings'][0]
                if not e['readings']:
                    e['readings'] = [e['pinyin']]
                e['acceptedReadings'] = sorted(set(e['readings'] + pinyin(e['char'], style=Style.TONE, heteronym=True)[0]))
                assert re.fullmatch(r'[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜêńňǹḿ]+', e['pinyin']), e
            path = f'小学/语文/统编版/义务教育教科书·语文{numeral}年级{term}册.pdf'
            books.append(dict(id=f'g{grade}-{code}', grade=grade, term=term, title=f'{numeral}年级{term}册',
                              source=dict(repository='TapXWorld/ChinaTextbook', commit=COMMIT, path=path,
                                          sha256=hashlib.sha256(file.read_bytes()).hexdigest(),
                                          recognizePages=read_pages, writePages=write_pages,
                                          recognizeCount=read_expected, writeCount=write_expected,
                                          wordPagesStart=word_start + 1 if word_start is not None else None),
                              characters=list(entries.values())))
            print(file.name, 'recognize', read_expected, 'write', write_expected, 'union', len(entries))
    output = dict(schemaVersion=1, scope='统编版旧版公开镜像字表；未确认南京各校当前使用版本，不代表2024年起修订教材。',
                  pronunciationNote='拼音优先取教材字表或词语表语境；写字表未标音的字由 pypinyin 生成常用读音。多音字显示本卡读音，其他读音并非错误。未提供笔顺评分。',
                  books=books)
    (ROOT / 'data.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()
