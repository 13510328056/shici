"""
Final data expansion — Places / Auto-annotation / Pingze
Runs from project root: python scripts/final_data_expansion.py
"""
import sys, os, json, asyncio, re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///' + os.path.join(
    os.path.dirname(__file__), '..', 'backend', 'poetry_space_dev.db')

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
engine = create_async_engine(os.environ['DATABASE_URL'], echo=False)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

from app.core.compat import utcnow
from app.models.place_name import PlaceName, PlaceNameChange
from app.models.poetry import Poetry, PoetryFeature
from app.models.poet import Poet
from app.services.rhythm import PINGZE

SRC = r'E:\PythonPrj\GSC\chinese-poetry'

# ═══════════════════════════════════════════
# Phase B: Place Expansion
# ═══════════════════════════════════════════
EXTRA_PLACES = [
    # Major Chinese cities missing from seed data
    ("深圳", "深圳", 114.06, 22.54, "广东省", "深圳市", None, 2, "经济特区"),
    ("厦门", "厦门", 118.09, 24.48, "福建省", "厦门市", None, 2, "经济特区"),
    ("大连", "大连", 121.62, 38.91, "辽宁省", "大连市", None, 2, "港口城市"),
    ("青岛", "青岛", 120.38, 36.07, "山东省", "青岛市", None, 2, "海滨城市"),
    ("宁波", "宁波", 121.54, 29.87, "浙江省", "宁波市", None, 2, "港口城市"),
    ("珠海", "珠海", 113.57, 22.27, "广东省", "珠海市", None, 2, "经济特区"),
    ("哈尔滨", "哈尔滨", 126.54, 45.80, "黑龙江省", "哈尔滨市", None, 2, "黑龙江省会"),
    ("长春", "长春", 125.32, 43.90, "吉林省", "长春市", None, 2, "吉林省会"),
    ("沈阳", "沈阳", 123.43, 41.80, "辽宁省", "沈阳市", None, 2, "辽宁省会"),
    ("石家庄", "石家庄", 114.50, 38.04, "河北省", "石家庄市", None, 2, "河北省会"),
    ("太原", "太原", 112.55, 37.87, "山西省", "太原市", None, 2, "山西省会"),
    ("呼和浩特", "呼和浩特", 111.75, 40.84, "内蒙古", "呼和浩特市", None, 2, "内蒙古首府"),
    ("合肥", "合肥", 117.28, 31.86, "安徽省", "合肥市", None, 2, "安徽省会"),
    ("福州", "福州", 119.30, 26.07, "福建省", "福州市", None, 2, "福建省会"),
    ("南昌", "南昌", 115.86, 28.68, "江西省", "南昌市", None, 2, "江西省会"),
    ("济南", "济南", 117.00, 36.65, "山东省", "济南市", None, 2, "山东省会"),
    ("郑州", "郑州", 113.65, 34.76, "河南省", "郑州市", None, 2, "河南省会"),
    ("武汉", "武汉", 114.28, 30.57, "湖北省", "武汉市", None, 2, "湖北省会"),
    ("长沙", "长沙", 112.94, 28.23, "湖南省", "长沙市", None, 2, "湖南省会"),
    ("广州", "广州", 113.27, 23.13, "广东省", "广州市", None, 2, "广东省会"),
    ("南宁", "南宁", 108.37, 22.82, "广西", "南宁市", None, 2, "广西首府"),
    ("海口", "海口", 110.33, 20.04, "海南省", "海口市", None, 2, "海南省会"),
    ("重庆", "重庆", 106.55, 29.57, "重庆市", "重庆市", None, 1, "直辖市"),
    ("贵阳", "贵阳", 106.63, 26.65, "贵州省", "贵阳市", None, 2, "贵州省会"),
    ("昆明", "昆明", 102.83, 24.88, "云南省", "昆明市", None, 2, "云南省会"),
    ("拉萨", "拉萨", 91.13, 29.65, "西藏", "拉萨市", None, 2, "西藏首府"),
    ("西安", "西安", 108.94, 34.26, "陕西省", "西安市", None, 2, "陕西省会"),
    ("兰州", "兰州", 103.83, 36.06, "甘肃省", "兰州市", None, 2, "甘肃省会"),
    ("西宁", "西宁", 101.78, 36.62, "青海省", "西宁市", None, 2, "青海省会"),
    ("银川", "银川", 106.28, 38.47, "宁夏", "银川市", None, 2, "宁夏首府"),
    ("乌鲁木齐", "乌鲁木齐", 87.62, 43.82, "新疆", "乌鲁木齐市", None, 2, "新疆首府"),
    ("台北", "台北", 121.52, 25.03, "台湾省", "台北市", None, 2, "台湾省会"),
    ("香港", "香港", 114.17, 22.28, "香港", "香港", None, 1, "特别行政区"),
    ("澳门", "澳门", 113.55, 22.19, "澳门", "澳门", None, 1, "特别行政区"),

    # Famous mountains and rivers (for poetry geo-tagging)
    ("昆仑山", "昆仑山", 81.0, 36.0, "新疆/青海", None, None, 4, "万山之祖"),
    ("祁连山", "祁连山", 99.0, 38.0, "甘肃/青海", None, None, 4, "河西走廊"),
    ("贺兰山", "贺兰山", 106.0, 38.5, "宁夏", None, None, 4, "西夏神山"),
    ("阴山", "阴山", 110.0, 41.0, "内蒙古", None, None, 4, "塞外屏障"),
    ("玉门关", "玉门关", 93.5, 40.0, "甘肃省", "敦煌市", None, 4, "丝绸之路关隘"),
    ("阳关", "阳关", 93.8, 39.9, "甘肃省", "敦煌市", None, 4, "丝绸之路关隘"),
    ("剑门关", "剑门关", 105.5, 32.0, "四川省", "广元市", None, 4, "蜀道天险"),
    ("洞庭湖", "洞庭湖", 112.5, 29.2, "湖南省", "岳阳市", None, 4, "中国第二大淡水湖"),
    ("鄱阳湖", "鄱阳湖", 116.3, 29.0, "江西省", None, None, 4, "中国第一大淡水湖"),
    ("西湖", "西湖", 120.14, 30.25, "浙江省", "杭州市", None, 4, "杭州西湖"),
    ("赤壁", "赤壁", 113.9, 29.72, "湖北省", "赤壁市", None, 4, "赤壁之战"),
    ("乌江", "乌江", 108.0, 28.5, "贵州省", None, None, 4, "项羽自刎处"),
    ("汨罗江", "汨罗江", 113.0, 28.8, "湖南省", None, None, 4, "屈原投江处"),
    ("滁州", "滁州", 118.31, 32.30, "安徽省", "滁州市", None, 2, "醉翁亭"),
    ("醉翁亭", "醉翁亭", 118.35, 32.28, "安徽省", "滁州市", None, 4, "欧阳修"),
    ("滕王阁", "滕王阁", 115.86, 28.68, "江西省", "南昌市", None, 4, "王勃序文"),
    ("黄鹤楼", "黄鹤楼", 114.28, 30.55, "湖北省", "武汉市", None, 4, "崔颢题诗"),
    ("岳阳楼", "岳阳楼", 113.08, 29.38, "湖南省", "岳阳市", None, 4, "范仲淹记"),
]

# ═══════════════════════════════════════════
# Phase D: Auto-Annotation (Rule-based)
# ═══════════════════════════════════════════
# Season keywords
SEASON_MAP = {
    '春': '春', '春风': '春', '春雨': '春', '春花': '春', '春草': '春',
    '夏': '夏', '夏日': '夏', '夏雨': '夏', '荷花': '夏',
    '秋': '秋', '秋风': '秋', '秋雨': '秋', '秋月': '秋', '秋霜': '秋',
    '冬': '冬', '冬日': '冬', '冬雪': '冬', '寒风': '冬', '寒雪': '冬',
    '梅': '冬', '雪': '冬', '霜': '秋',
}

# Mood keywords
MOOD_MAP = {
    '愁': '感怀', '悲': '感怀', '泪': '感怀', '哀': '感怀', '伤': '感怀',
    '忧': '感怀', '恨': '感怀', '怨': '感怀', '泣': '感怀', '哭': '感怀',
    '思': '思乡', '念': '思乡', '忆': '思乡', '归': '思乡',
    '别': '送别', '送': '送别', '离': '送别', '行': '送别',
    '战': '边塞', '征': '边塞', '戍': '边塞', '烽': '边塞', '塞': '边塞',
    '闲': '田园', '归隐': '田园', '采菊': '田园',
    '酒': '豪放', '剑': '豪放', '壮': '豪放',
    '仙': '游仙', '道': '游仙', '梦': '游仙',
}

# Imagery keywords
IMAGERY_MAP = {
    '月': '月', '明月': '月', '残月': '月', '秋月': '月',
    '风': '风', '秋风': '风', '春风': '风', '寒风': '风', '北风': '风',
    '云': '云', '白云': '云', '青云': '云', '浮云': '云',
    '雨': '雨', '春雨': '雨', '秋雨': '雨', '烟雨': '雨',
    '雪': '雪', '白雪': '雪', '飞雪': '雪',
    '山': '山', '青山': '山', '远山': '山', '南山': '山',
    '水': '水', '江水': '水', '河水': '水', '清水': '水',
    '花': '花', '落花': '花', '桃花': '花', '梅花': '花', '菊花': '花', '荷花': '花',
    '柳': '柳', '杨柳': '柳', '垂柳': '柳',
    '酒': '酒', '美酒': '酒', '清酒': '酒',
    '剑': '剑', '长剑': '剑', '宝剑': '剑',
    '琴': '琴', '古琴': '琴', '瑶琴': '琴',
    '舟': '舟', '扁舟': '舟', '孤舟': '舟', '归舟': '舟',
    '马': '马', '老马': '马', '战马': '马', '铁马': '马',
    '雁': '雁', '鸿雁': '雁', '孤雁': '雁', '归雁': '雁',
    '鹤': '鹤', '白鹤': '鹤', '孤鹤': '鹤',
    '龙': '龙', '苍龙': '龙',
    '凤': '凤', '凤凰': '凤',
    '日': '日', '落日': '日', '夕阳': '日', '残阳': '日',
    '烟': '烟', '孤烟': '烟', '寒烟': '烟',
    '霜': '霜', '寒霜': '霜', '秋霜': '霜',
}


async def phase_b_places(session):
    """Add more places"""
    added = 0
    for row in EXTRA_PLACES:
        r = await session.execute(select(PlaceName).where(PlaceName.ancient_name == row[0]))
        if r.scalar_one_or_none():
            continue
        p = PlaceName(ancient_name=row[0], modern_name=row[1],
            wgs84_lon=row[2], wgs84_lat=row[3],
            province=row[4], city=row[5], district=row[6],
            admin_level=row[7], source=row[8], created_at=utcnow())
        session.add(p)
        added += 1
    await session.flush()
    print(f'B: Added {added} places', flush=True)


async def phase_d_annotate(session):
    """Rule-based annotation for poems without features"""
    # Find poems without features
    stmt = select(Poetry).outerjoin(PoetryFeature,
        PoetryFeature.poetry_id == Poetry.poetry_id).where(PoetryFeature.id.is_(None)).limit(50000)
    poems = (await session.execute(stmt)).scalars().all()
    print(f'D: Poems needing annotation: {len(poems)}', flush=True)

    added = 0
    for poem in poems:
        content = poem.content or ''
        season_set = set()
        mood_set = set()
        imagery_set = set()
        festival_set = set()

        for keyword, tag in SEASON_MAP.items():
            if keyword in content:
                season_set.add(tag)
        for keyword, tag in MOOD_MAP.items():
            if keyword in content:
                mood_set.add(tag)
        for keyword, tag in IMAGERY_MAP.items():
            if keyword in content:
                imagery_set.add(tag)

        festivals = {'端午': '端午', '重阳': '重阳', '中秋': '中秋', '清明': '清明',
                     '元宵': '元宵', '七夕': '七夕', '除夕': '除夕'}
        for kw, tag in festivals.items():
            if kw in content:
                festival_set.add(tag)

        feat = PoetryFeature(
            poetry_id=poem.poetry_id,
            season=list(season_set) if season_set else None,
            mood_tags=list(mood_set) if mood_set else None,
            imagery_items=list(imagery_set) if imagery_set else None,
            festival=list(festival_set) if festival_set else None,
        )
        session.add(feat)
        added += 1

        if added % 500 == 0:
            await session.flush()
            print(f'  D: {added} annotated...', flush=True)

    await session.flush()
    print(f'D: Annotated {added} poems', flush=True)


async def phase_e_pingze(session):
    """Extract pingze from chinese-poetry strains data"""
    strain_dir = os.path.join(SRC, 'strains', 'json')
    if not os.path.isdir(strain_dir):
        print('E: No strains directory found', flush=True)
        return

    new_chars = {}
    files = sorted(f for f in os.listdir(strain_dir) if f.endswith('.json'))

    for fname in files[:50]:  # Process first 50 files (~50k poems)
        with open(os.path.join(strain_dir, fname), 'r', encoding='utf-8') as f:
            data = json.load(f)
        for entry in data:
            for strain_line in entry.get('strains', []):
                for ch in strain_line:
                    if ch in ('平', '仄', '中', '，', '。', '、', ' '):
                        continue
                    if ch not in PINGZE and ch not in new_chars:
                        # Determine pingze from preceding marker
                        pass  # Too complex; skip for now

    print(f'E: Pingze expansion requires manual curation', flush=True)
    print(f'E: Current PINGZE size: {len(PINGZE)}', flush=True)


async def main():
    async with Session() as session:
        print('=== Phase B: Place Expansion ===', flush=True)
        await phase_b_places(session)
        await session.commit()

        print('=== Phase D: Auto-Annotation ===', flush=True)
        await phase_d_annotate(session)
        await session.commit()

        print('=== Phase E: Pingze Check ===', flush=True)
        await phase_e_pingze(session)

        # Final stats
        for M, N in [(Poetry, 'Poems'), (Poet, 'Poets'), (PlaceName, 'Places'),
                     (PoetryFeature, 'Features'), (PlaceNameChange, 'NameChanges')]:
            cnt = (await session.execute(select(func.count()).select_from(M))).scalar()
            print(f'  {N}: {cnt}', flush=True)

        # Feature coverage
        total_poems = (await session.execute(select(func.count()).select_from(Poetry))).scalar()
        total_feats = (await session.execute(select(func.count()).select_from(PoetryFeature))).scalar()
        print(f'  Feature coverage: {total_feats}/{total_poems} ({total_feats*100//total_poems}%)', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
