"""
对仗推荐引擎 — 需求 4.4.1
基于语义分类 + 平仄相对 的规则引擎
"""

from typing import Optional

# ─── 语义分类体系 ──────────────────────────────
# 按照传统诗词对仗分类
SEMANTIC_CATEGORIES: dict[str, list[str]] = {
    '天文': '天日日月星辰风云雨雪霜露虹霞烟霄汉斗雷',
    '地理': '地山山水江河海浪潮波涛沙石土城乡村关道路岭岳峰谷涧洲浦岸屿野原陂',
    '时令': '时岁年春秋冬夏昼夜朝夕晓暮晚昏旦晨暑寒凉暖节序',
    '动物': '龙凤虎鹤鹿马牛羊犬鸡猿猴鸟雁燕鹭鸥莺鹊鸦鸿鹏麟龟鱼蛇蝉蝶蜂萤蚕蛾',
    '植物': '花草树木松柏杨柳桃李杏梅兰竹菊荷莲桂棠梨桔枣桑桐',
    '人物': '人君臣帝王侯相将帅士农工商客友宾主圣贤才士夫妇女子孙兄弟姊妹父母儿女',
    '器物': '舟船车马辇轿弓箭剑戟刀枪旗鼓琴瑟箫笛钟鼎杯盏壶樽盘筷扇帘帷帐灯烛',
    '衣饰': '衣冠裳裙钗环佩缨簪冠巾带履靴袍裘衫',
    '饮食': '酒茶饭肴羹汤粥食菜肴餐杯盏饮醉醒饱饥',
    '建筑': '楼台亭阁轩榭廊宫殿庙寺观庵宅院门窗户阶栏梁柱檐壁墙',
    '颜色': '红白黑碧绿翠紫黄金朱丹青素彩粉黛绯苍蓝',
    '数字': '一二三四五六七八九十百千万亿双半孤独两几数',
    '方位': '东南西北中前后左右内外上下旁侧间里表',
    '身体': '身心耳目口鼻手足眉眼发鬓须眉颜面骨肉血脉魂魄影',
    '情感': '愁恨悲欢离合喜怒哀乐忧思怨惊恐爱情亲情友情寂寞孤独闲逸',
    '动作': '行飞翔奔走坐卧立卧登临望观看听闻吟咏唱叹歌舞笑泣语言语歌哭鸣啼叫呐喊呼号吹弹奏',
    '状态': '长短高深浅厚薄轻重远近疏密多少浓淡清浊明暗冷暖寒热枯荣兴亡生死有无来去进退动静开闭',
}

# 字→分类映射
CHAR_CATEGORY: dict[str, list[str]] = {}
for cat, chars in SEMANTIC_CATEGORIES.items():
    for ch in chars:
        if ch not in CHAR_CATEGORY:
            CHAR_CATEGORY[ch] = []
        CHAR_CATEGORY[ch].append(cat)

# ─── 经典对仗示例 ──────────────────────────────
CLASSIC_ANTITHESIS: list[tuple[str, str, str, str]] = [
    # (词1, 词2, 分类, 例句/出处)
    # 天文类
    ('天', '地', '天文', '天高地迥'),
    ('日', '月', '天文', '日月同辉'),
    ('风', '雨', '天文', '风雨同舟'),
    ('云', '雨', '天文', '云行雨施'),
    ('霜', '雪', '天文', '霜雪覆盖'),
    ('星', '月', '天文', '星月交辉'),
    ('朝', '暮', '时令', '朝暮相处'),
    ('春', '秋', '时令', '春秋笔法'),
    ('山', '水', '地理', '山清水秀'),
    ('江', '海', '地理', '江海寄余生'),
    ('河', '岳', '地理', '河岳钟灵'),
    ('城', '郭', '地理', '城郭依稀'),
    ('关', '山', '地理', '关山难越'),
    ('花', '鸟', '动物', '花鸟怡情'),
    ('莺', '燕', '动物', '莺歌燕舞'),
    ('龙', '凤', '动物', '龙凤呈祥'),
    ('鹤', '松', '动物', '鹤发松姿'),
    ('柳', '花', '植物', '柳暗花明'),
    ('桃', '李', '植物', '桃李满天下'),
    ('松', '竹', '植物', '松竹长青'),
    ('梅', '雪', '植物', '梅雪争春'),
    ('金', '玉', '器物', '金玉良缘'),
    ('琴', '酒', '器物', '琴酒相伴'),
    ('剑', '箫', '器物', '剑胆箫心'),
    ('诗', '酒', '器物', '诗酒趁年华'),
    ('红', '绿', '颜色', '红情绿意'),
    ('白', '青', '颜色', '白水青天'),
    ('千', '万', '数字', '千山万水'),
    ('一', '三', '数字', '一波三折'),
    ('东', '西', '方位', '东倒西歪'),
    ('南', '北', '方位', '南辕北辙'),
    ('前', '后', '方位', '前呼后应'),
    ('来', '去', '动作', '来龙去脉'),
    ('行', '止', '动作', '行云止水'),
    ('吟', '咏', '动作', '吟风咏月'),
    ('悲', '喜', '情感', '悲欢离合'),
    ('离', '合', '情感', '离合悲欢'),
    ('明', '暗', '状态', '明枪暗箭'),
    ('深', '浅', '状态', '深入浅出'),
    ('归', '去', '动作', '归去来兮'),
    ('醉', '醒', '状态', '醉生梦死'),
    ('高', '下', '状态', '高下立判'),
    ('长', '短', '状态', '长吁短叹'),
    ('泪', '愁', '情感', '泪愁交织'),
    ('秋', '月', '时令', '春花秋月'),  # 跨类
    ('春', '花', '时令', '春风花月'),  # 跨类
    ('长', '远', '状态', '源远流长'),
    ('情', '意', '情感', '情投意合'),
    ('浮', '沉', '状态', '浮沉世事'),
    ('君', '臣', '人物', '君明臣良'),
]

# ─── 工对/宽对/流水对判定 ──────────────────
def _match_quality(word1: str, word2: str) -> tuple[Optional[str], float]:
    """计算两个词的对仗质量

    Returns:
        (对仗类型, 质量分数)
        工对 > 宽对 > 流水对
    """
    cats1 = CHAR_CATEGORY.get(word1, [])
    cats2 = CHAR_CATEGORY.get(word2, [])

    # 工对：同类目
    common = set(cats1) & set(cats2)
    if common:
        return ('工对', 0.9)

    # 跨类但语义相关（如"秋"和"月"：时令+天文）
    # 检查经典对仗
    for w1, w2, _, _ in CLASSIC_ANTITHESIS:
        if (word1 == w1 and word2 == w2) or (word1 == w2 and word2 == w1):
            return ('工对', 0.95)
        if word1 in (w1, w2) and word2 in (w1, w2):
            return ('宽对', 0.7)

    # 检查平仄是否相对
    from .rhythm import get_pingze
    pz1 = get_pingze(word1)
    pz2 = get_pingze(word2)

    if pz1 is not None and pz2 is not None and pz1 != pz2:
        # 平仄相对，且语义上有关联
        return ('宽对', 0.6)

    if cats1 and cats2:
        # 不同类但有语义范畴
        return ('流水对', 0.4)

    return (None, 0.0)


class AntithesisService:
    """对仗推荐服务"""

    async def recommend(
        self,
        input_text: str,
        position: Optional[str] = None,
        genre: Optional[str] = None,
        mood_tag: Optional[str] = None,
    ) -> dict:
        """根据输入词推荐对仗词汇"""
        # 取输入文本的最后一个词
        words = [w for w in input_text if '一' <= w <= '鿿']  # 只取汉字
        if not words:
            return {'input_text': input_text, 'candidates': []}

        target = words[-1]
        candidates = []

        # 查找经典对仗
        for w1, w2, cat, example in CLASSIC_ANTITHESIS:
            if w1 == target:
                candidates.append((w2, cat, example))
            elif w2 == target:
                candidates.append((w1, cat, example))

        # 查找同类目下的其他词
        cats = CHAR_CATEGORY.get(target, [])
        for cat in cats:
            for ch in SEMANTIC_CATEGORIES.get(cat, ''):
                if ch != target and ch not in [c[0] for c in candidates]:
                    from .rhythm import get_pingze
                    pz1 = get_pingze(target)
                    pz2 = get_pingze(ch)
                    if pz1 is not None and pz2 is not None and pz1 != pz2:
                        candidates.append((ch, cat, f'同类{cat}对仗'))

        # 限量和评分
        seen = set()
        result = []
        for word, cat, example in candidates:
            if word in seen:
                continue
            seen.add(word)
            match_type, score = _match_quality(target, word)
            if match_type:
                result.append({
                    'word': word,
                    'category': match_type,
                    'semantic_category': cat,
                    'example': example[:20] if example else '',
                    'score': round(score, 2),
                })

        # 排序：工对优先
        cat_order = {'工对': 0, '宽对': 1, '流水对': 2}
        result.sort(key=lambda x: (cat_order.get(x['category'], 9), -x['score']))

        return {
            'input_text': input_text,
            'target_word': target,
            'candidates': result[:15],
        }

    async def check_rhythm(
        self,
        content: str,
        genre: str = '七绝',
        rhyme_system: str = '平水韵',
    ) -> dict:
        """格律校验 — 委托给 RhythmCheckService"""
        from .rhythm import RhythmCheckService
        return await RhythmCheckService().check(content, genre, rhyme_system)
