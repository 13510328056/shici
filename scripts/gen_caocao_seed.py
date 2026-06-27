"""曹操种子数据生成脚本"""
import json

# Read caocao.json
with open('E:/PythonPrj/GSC/chinese-poetry/曹操诗集/caocao.json', 'r', encoding='utf-8') as f:
    poems = json.load(f)

# Write seed file
with open('data/caocao/seed_caocao.py', 'w', encoding='utf-8') as f:
    f.write('"""\n')
    f.write('曹操种子数据 — 诗人 + 轨迹 + %d 首诗词\n' % len(poems))
    f.write('数据来源：chinese-poetry/曹操诗集\n')
    f.write('"""\n\n')

    # Poet entry
    f.write('CAO_POET = {\n')
    f.write('    "name": "曹操", "birth_year": "155", "death_year": "220",\n')
    f.write('    "dynasty": "魏晋", "tags": ["建安风骨", "政治家", "军事家"],\n')
    f.write('}\n\n')

    # Trajectories
    f.write('CAO_TRAJECTORIES = [\n')
    for item in [
        ('曹操', '155', '沛国', 116.1, 34.3, '出生', 'null', '生于沛国谯县'),
        ('曹操', '174', '洛阳', 112.45, 34.62, '仕宦', '1095', '举孝廉，任洛阳北部尉'),
        ('曹操', '184', '济南', 117.0, 36.65, '仕宦', '730', '任济南相'),
        ('曹操', '190', '陈留', 114.5, 34.7, '军事', '365', '起兵讨董卓'),
        ('曹操', '192', '兖州', 116.0, 35.5, '军事', '365', '收编青州兵'),
        ('曹操', '196', '许都', 113.8, 34.0, '政治', '3650', '迎献帝，迁都许昌'),
        ('曹操', '200', '官渡', 114.2, 34.8, '军事', '30', '官渡之战大败袁绍'),
        ('曹操', '207', '碣石', 119.5, 39.8, '军事', '30', '北征乌桓，观沧海'),
        ('曹操', '208', '赤壁', 113.9, 29.72, '军事', '60', '赤壁之战'),
        ('曹操', '210', '邺城', 114.5, 36.3, '政治', '3650', '建铜雀台'),
        ('曹操', '220', '洛阳', 112.45, 34.62, '去世', 'null', '病逝洛阳'),
    ]:
        f.write('    %s,\n' % json.dumps(list(item), ensure_ascii=False))
    f.write(']\n\n')

    # Poems as simple title+content pairs
    f.write('CAO_POEMS = [\n')
    for p in poems:
        title = p['title']
        content = '' . join(p['paragraphs'])
        entry = json.dumps({"title": title, "content": content, "dynasty": "魏晋", "genre": "乐府", "mood_tags": ["建安", "古风"]}, ensure_ascii=False)
        f.write('    %s,\n' % entry)
    f.write(']\n')

print('曹操种子数据生成完成！')
print('  诗人: 曹操 (155-220)')
print('  轨迹: 11 条')
print('  诗词: %d 首' % len(poems))
