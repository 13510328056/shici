"""
意境匹配创作工具 — 需求 4.4.2
多维度条件匹配 + 双层创作框架（入门/进阶）
"""

from typing import Optional

# ─── 意境→意象映射 ──────────────────────────
MOOD_IMAGERY: dict[str, dict] = {
    '送别': {
        'description': '离情别绪，依依不舍，前程万里',
        'imagery': ['杨柳', '长亭', '酒', '孤帆', '远山', '流水', '落日', '雁', '笛声', '泪'],
        'places': ['渭城', '灞桥', '阳关', '江陵', '金陵'],
        'classic_lines': ['劝君更尽一杯酒，西出阳关无故人', '孤帆远影碧空尽，唯见长江天际流'],
    },
    '思乡': {
        'description': '思念故土，归心似箭，月明人远',
        'imagery': ['明月', '故乡', '鸿雁', '家书', '秋风', '落叶', '孤灯', '夜雨', '篱笆', '炊烟'],
        'places': ['洛阳', '长安', '江南', '巴山', '越州'],
        'classic_lines': ['举头望明月，低头思故乡', '春风又绿江南岸，明月何时照我还'],
    },
    '边塞': {
        'description': '大漠孤烟，金戈铁马，豪情壮志',
        'imagery': ['大漠', '孤烟', '长河', '落日', '旌旗', '号角', '铁衣', '战马', '胡雁', '羌笛'],
        'places': ['凉州', '玉门关', '阳关', '轮台', '阴山'],
        'classic_lines': ['大漠孤烟直，长河落日圆', '黄沙百战穿金甲，不破楼兰终不还'],
    },
    '田园': {
        'description': '悠然自得，山水之间，闲适恬淡',
        'imagery': ['青山', '绿水', '茅屋', '篱笆', '桑麻', '鸡犬', '炊烟', '牧童', '笛声', '荷锄'],
        'places': ['辋川', '襄阳', '柴桑', '鹿门', '铜川'],
        'classic_lines': ['采菊东篱下，悠然见南山', '开轩面场圃，把酒话桑麻'],
    },
    '怀古': {
        'description': '历史兴衰，古人已逝，古迹依旧',
        'imagery': ['古迹', '残碑', '断壁', '荒草', '夕阳', '流水', '明月', '松柏', '台城', '铜雀'],
        'places': ['金陵', '赤壁', '洛阳', '长安', '姑苏'],
        'classic_lines': ['旧时王谢堂前燕，飞入寻常百姓家', '千古兴亡多少事，悠悠'],
    },
    '登临': {
        'description': '登高望远，胸襟万里，感慨万千',
        'imagery': ['高楼', '远山', '长空', '白云', '飞鸟', '长江', '孤城', '落日', '秋风', '归雁'],
        'places': ['黄鹤楼', '岳阳楼', '鹳雀楼', '滕王阁', '幽州台'],
        'classic_lines': ['欲穷千里目，更上一层楼', '无边落木萧萧下，不尽长江滚滚来'],
    },
    '闺怨': {
        'description': '深闺寂寞，相思难抑，年华易逝',
        'imagery': ['珠帘', '锦衾', '玉簟', '罗裳', '朱阁', '绮户', '孤灯', '晓月', '鸦啼', '落叶'],
        'places': ['凤楼', '西楼', '南浦', '西厢', '兰闺'],
        'classic_lines': ['此情无计可消除，才下眉头，却上心头', '帘卷西风，人比黄花瘦'],
    },
    '山水': {
        'description': '山川之美，自然之趣，心旷神怡',
        'imagery': ['青山', '碧水', '飞瀑', '流泉', '松涛', '竹影', '云雾', '霞光', '孤舟', '垂钓'],
        'places': ['庐山', '黄山', '西湖', '洞庭', '终南山'],
        'classic_lines': ['飞流直下三千尺，疑是银河落九天', '水光潋滟晴方好，山色空蒙雨亦奇'],
    },
}

SEASON_IMAGERY: dict[str, dict] = {
    '春': {'imagery': ['东风', '杨柳', '桃花', '莺歌', '燕舞', '杏花', '春雨', '春水', '草色', '蝶飞'], 'description': '春意盎然，万物复苏'},
    '夏': {'imagery': ['荷风', '蝉鸣', '碧波', '竹影', '榴花', '雨霁', '晴空', '绿荫', '蛙声', '萤火'], 'description': '夏日悠长，绿树成荫'},
    '秋': {'imagery': ['秋风', '明月', '落叶', '霜天', '菊花', '鸿雁', '梧桐', '枫叶', '寒蝉', '暮云'], 'description': '秋高气爽，落叶飘零'},
    '冬': {'imagery': ['飞雪', '寒梅', '冰凌', '朔风', '孤松', '炉火', '琼枝', '珠帘', '雪径', '寒江'], 'description': '冬雪皑皑，岁寒三友'},
}


class MoodMatchingService:
    """意境匹配创作服务"""

    async def generate(
        self,
        mood_tag: str = '山水',
        season: Optional[str] = None,
        location: Optional[str] = None,
        level: str = '入门',
        genre: str = '七绝',
    ) -> dict:
        """生成创作框架"""
        mood_data = MOOD_IMAGERY.get(mood_tag)
        if not mood_data:
            return {'error': f'未知意境: {mood_tag}', 'available_moods': list(MOOD_IMAGERY.keys())}

        result = {
            'mood': mood_tag,
            'description': mood_data['description'],
            'season': season,
            'location': location,
            'level': level,
            'genre': genre,
            'framework': {},
            'recommended_imagery': [],
            'writing_tips': [],
            'referenced_classics': [],
        }

        # 意象组合
        imagery_pool = list(mood_data['imagery'])
        if season and season in SEASON_IMAGERY:
            imagery_pool.extend(SEASON_IMAGERY[season]['imagery'])

        result['recommended_imagery'] = imagery_pool[:10]

        # 地点
        places_pool = list(mood_data['places'])
        if location and location in places_pool:
            places_pool = [location] + [p for p in places_pool if p != location]

        # 框架
        if level == '入门':
            result['framework'] = {
                'title': f'{mood_tag}即兴（{genre}）',
                'tips': [
                    f'以{mood_tag}为立意，选取2-3个意象',
                    f'首句点题，次句辅景，第三句转折，末句收束',
                    f'可参考{mood_data["classic_lines"][0] if mood_data["classic_lines"] else "同类经典"}的意境',
                ],
                'template': f'{mood_tag}之意，{season or "四时"}之景。前两句铺陈{imagery_pool[0]}{imagery_pool[1] if len(imagery_pool)>1 else ""}，后两句抒发{ {"送别":"离情","思乡":"归心","边塞":"壮志","田园":"闲情","怀古":"幽思","登临":"感慨","闺怨":"闲愁","山水":"逸趣"}.get(mood_tag, "情怀") }。',
            }
        else:
            result['framework'] = {
                'title': f'{mood_tag}赋（{genre}）',
                'tips': [
                    f'起承转合严依{genre}格律',
                    f'前两联写景：{mood_tag}特色意象+{season or "当令"}景致',
                    f'后两联抒情：化用典故，联系自身际遇',
                    f'注意平仄相对，避免失粘失对',
                ],
                'template': f'{genre}体例，{mood_tag}为题。取{places_pool[0] if places_pool else "山水"}之境，融{imagery_pool[0]}{imagery_pool[1] if len(imagery_pool)>1 else ""}之象，以{ {"送别":"离愁别绪","思乡":"故园之思","边塞":"报国之志","田园":"归隐之心","怀古":"兴亡之感","登临":"凌云之志","闺怨":"幽思之情","山水":"林泉之趣"}.get(mood_tag, "雅意") }贯之。',
            }

        # 写作指引
        result['writing_tips'] = [
            f'意境核心：{mood_data["description"]}',
            f'推荐意象：{"、".join(imagery_pool[:6])}',
            f'可用背景：{places_pool[0] if places_pool else "山水之间"}',
        ]

        # 引用经典
        result['referenced_classics'] = mood_data['classic_lines']

        return result
