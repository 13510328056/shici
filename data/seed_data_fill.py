"""
数据补齐脚本：扩充缺失朝代诗人 + 填充空表
"""
import asyncio
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///' + os.path.join(os.path.dirname(__file__), '..', 'backend', 'poetry_space_dev.db')

from sqlalchemy import select
from app.core.database import async_session_factory
from app.core.compat import utcnow
from app.models.poet import Poet, PoetTrajectory, PoetEncounter
from app.models.place_name import PlaceName, PlaceNameChange
from app.models.poetry import Poetry, PoetryFeature

# ────────────────────────────────────────────
# 扩充诗人（重点：汉/魏晋/明/清/先秦）
# ────────────────────────────────────────────
EXTRA_POETS = [
    # 汉
    {"name": "刘邦", "birth_year": "前256", "death_year": "前195", "dynasty": "汉", "tags": ["帝王", "大风歌"]},
    {"name": "项羽", "birth_year": "前232", "death_year": "前202", "dynasty": "汉", "tags": ["霸王", "垓下歌"]},
    {"name": "司马相如", "birth_year": "前179", "death_year": "前117", "dynasty": "汉", "tags": ["辞赋家", "汉赋四大家"]},
    {"name": "卓文君", "birth_year": "前175", "death_year": "前121", "dynasty": "汉", "tags": ["才女"]},
    {"name": "班固", "birth_year": "32", "death_year": "92", "dynasty": "汉", "tags": ["史学家", "汉书"]},

    # 魏晋
    {"name": "曹植", "birth_year": "192", "death_year": "232", "dynasty": "魏晋", "tags": ["建安风骨", "才高八斗"]},
    {"name": "曹丕", "birth_year": "187", "death_year": "226", "dynasty": "魏晋", "tags": ["建安", "魏文帝"]},
    {"name": "陶渊明", "birth_year": "365", "death_year": "427", "dynasty": "魏晋", "tags": ["田园诗", "隐逸"]},
    {"name": "嵇康", "birth_year": "224", "death_year": "263", "dynasty": "魏晋", "tags": ["竹林七贤", "广陵散"]},
    {"name": "阮籍", "birth_year": "210", "death_year": "263", "dynasty": "魏晋", "tags": ["竹林七贤", "咏怀"]},
    {"name": "左思", "birth_year": "250", "death_year": "305", "dynasty": "魏晋", "tags": ["咏史诗"]},
    {"name": "陆机", "birth_year": "261", "death_year": "303", "dynasty": "魏晋", "tags": ["太康体", "文赋"]},

    # 明
    {"name": "于谦", "birth_year": "1398", "death_year": "1457", "dynasty": "明", "tags": ["民族英雄"]},
    {"name": "唐寅", "birth_year": "1470", "death_year": "1524", "dynasty": "明", "tags": ["江南四大才子"]},
    {"name": "王阳明", "birth_year": "1472", "death_year": "1529", "dynasty": "明", "tags": ["哲学家", "心学"]},
    {"name": "杨慎", "birth_year": "1488", "death_year": "1559", "dynasty": "明", "tags": ["临江仙"]},
    {"name": "汤显祖", "birth_year": "1550", "death_year": "1616", "dynasty": "明", "tags": ["戏剧家", "牡丹亭"]},

    # 清
    {"name": "曹雪芹", "birth_year": "1715", "death_year": "1763", "dynasty": "清", "tags": ["红楼梦"]},
    {"name": "郑板桥", "birth_year": "1693", "death_year": "1765", "dynasty": "清", "tags": ["扬州八怪"]},
    {"name": "龚自珍", "birth_year": "1792", "death_year": "1841", "dynasty": "清", "tags": ["己亥杂诗"]},
    {"name": "袁枚", "birth_year": "1716", "death_year": "1797", "dynasty": "清", "tags": ["随园诗话"]},
    {"name": "纪昀", "birth_year": "1724", "death_year": "1805", "dynasty": "清", "tags": ["四库全书"]},

    # 先秦
    {"name": "屈原", "birth_year": "前340", "death_year": "前278", "dynasty": "先秦", "tags": ["楚辞", "离骚"]},
    {"name": "宋玉", "birth_year": "前298", "death_year": "前222", "dynasty": "先秦", "tags": ["楚辞"]},
]

# 经典作品节选（用于填充无标注的诗人）
CLASSIC_WORKS = {
    "刘邦": [("大风歌", "大风起兮云飞扬，威加海内兮归故乡，安得猛士兮守四方！")],
    "项羽": [("垓下歌", "力拔山兮气盖世，时不利兮骓不逝。骓不逝兮可奈何，虞兮虞兮奈若何！")],
    "陶渊明": [("归园田居·其一", "少无适俗韵，性本爱丘山。误落尘网中，一去三十年。羁鸟恋旧林，池鱼思故渊。开荒南野际，守拙归园田。方宅十余亩，草屋八九间。榆柳荫后檐，桃李罗堂前。暧暧远人村，依依墟里烟。狗吠深巷中，鸡鸣桑树颠。户庭无尘杂，虚室有余闲。久在樊笼里，复得返自然。"),
                ("饮酒·其五", "结庐在人境，而无车马喧。问君何能尔？心远地自偏。采菊东篱下，悠然见南山。山气日夕佳，飞鸟相与还。此中有真意，欲辨已忘言。"),
                ("桃花源记（节选）", "晋太元中，武陵人捕鱼为业。缘溪行，忘路之远近。忽逢桃花林，夹岸数百步，中无杂树，芳草鲜美，落英缤纷。")],
    "曹植": [("七步诗", "煮豆持作羹，漉豉以为汁。萁在釜下燃，豆在釜中泣。本是同根生，相煎何太急？"),
              ("洛神赋（节选）", "其形也，翩若惊鸿，婉若游龙。荣曜秋菊，华茂春松。髣髴兮若轻云之蔽月，飘飖兮若流风之回雪。")],
    "曹丕": [("燕歌行", "秋风萧瑟天气凉，草木摇落露为霜。群燕辞归雁南翔，念君客游思断肠。慊慊思归恋故乡，君何淹留寄他方？贱妾茕茕守空房，忧来思君不敢忘，不觉泪下沾衣裳。援琴鸣弦发清商，短歌微吟不能长。明月皎皎照我床，星汉西流夜未央。牵牛织女遥相望，尔独何辜限河梁。")],
    "嵇康": [("赠秀才从军", "息徒兰圃，秣马华山。流磻平皋，垂纶长川。目送归鸿，手挥五弦。俯仰自得，游心太玄。")],
    "阮籍": [("咏怀·夜中不能寐", "夜中不能寐，起坐弹鸣琴。薄帷鉴明月，清风吹我襟。孤鸿号外野，翔鸟鸣北林。徘徊将何见？忧思独伤心。")],
    "屈原": [("离骚（节选）", "长太息以掩涕兮，哀民生之多艰。余虽好修姱以鞿羁兮，謇朝谇而夕替。亦余心之所善兮，虽九死其犹未悔。"),
              ("国殇", "操吴戈兮被犀甲，车错毂兮短兵接。旌蔽日兮敌若云，矢交坠兮士争先。")],
    "唐寅": [("桃花庵歌", "桃花坞里桃花庵，桃花庵里桃花仙。桃花仙人种桃树，又摘桃花换酒钱。酒醒只在花前坐，酒醉还来花下眠。半醒半醉日复日，花落花开年复年。")],
    "于谦": [("石灰吟", "千锤万凿出深山，烈火焚烧若等闲。粉骨碎身浑不怕，要留清白在人间。")],
    "王阳明": [("蔽月山房", "山近月远觉月小，便道此山大于月。若有人眼大如天，当见山高月更阔。")],
    "杨慎": [("临江仙·滚滚长江东逝水", "滚滚长江东逝水，浪花淘尽英雄。是非成败转头空。青山依旧在，几度夕阳红。白发渔樵江渚上，惯看秋月春风。一壶浊酒喜相逢。古今多少事，都付笑谈中。")],
    "龚自珍": [("己亥杂诗·其五", "浩荡离愁白日斜，吟鞭东指即天涯。落红不是无情物，化作春泥更护花。"),
                ("己亥杂诗·其二百二十", "九州生气恃风雷，万马齐喑究可哀。我劝天公重抖擞，不拘一格降人才。")],
}

# 地名沿革数据
PLACE_CHANGES = [
    ("长安", "前202", "长安", "京兆", "西汉定都"),
    ("长安", "582", "大兴城", "长安", "隋代新筑"),
    ("长安", "618", "长安", "京兆府", "唐代复名"),
    ("长安", "1369", "长安", "西安府", "明代更名"),
    ("洛阳", "前770", "洛邑", "洛阳", "东周都城"),
    ("洛阳", "25", "雒阳", "洛阳", "东汉定都"),
    ("洛阳", "605", "东都", "洛阳", "隋炀帝营建"),
    ("洛阳", "690", "神都", "洛阳", "武周时期"),
    ("洛阳", "938", "西京", "洛阳", "后晋改西京"),
    ("金陵", "前333", "金陵邑", "金陵", "楚威王置"),
    ("金陵", "212", "建业", "金陵", "孙权改名"),
    ("金陵", "317", "建康", "金陵", "东晋都城"),
    ("金陵", "937", "江宁", "金陵", "南唐都城"),
    ("金陵", "1368", "南京", "金陵", "明太祖定都"),
    ("汴州", "364", "开封", "汴州", "东魏置梁州"),
    ("汴州", "712", "汴州", "开封", "唐代汴州"),
    ("汴州", "960", "东京", "开封", "北宋都城"),
    ("杭州", "589", "杭州", "杭州", "隋置杭州"),
    ("杭州", "1127", "临安", "杭州", "南宋行在"),
    ("扬州", "前486", "邗城", "扬州", "吴王夫差筑"),
    ("扬州", "590", "扬州", "扬州", "隋改吴州为扬州"),
    ("苏州", "514", "阖闾城", "苏州", "吴王阖闾筑"),
    ("苏州", "589", "苏州", "苏州", "隋灭陈后更名"),
    ("成都", "前311", "成都", "成都", "秦置成都县"),
    ("成都", "221", "成都", "成都", "蜀汉都城"),
    ("成都", "907", "成都", "成都", "前蜀都城"),
    ("广州", "前214", "番禺", "广州", "秦置南海郡"),
    ("广州", "226", "广州", "广州", "吴置广州"),
]

# 代表性轨迹数据
NEW_TRAJECTORIES = [
    # 陶渊明
    ("陶渊明", "365", "浔阳", 115.98, 29.70, "出生", None, "生于柴桑"),
    ("陶渊明", "393", "江州", 115.98, 29.70, "仕宦", 365, "任江州祭酒"),
    ("陶渊明", "405", "彭泽", 116.55, 29.90, "仕宦", 80, "任彭泽令，弃官归隐"),
    ("陶渊明", "406", "浔阳", 115.98, 29.70, "隐居", 7300, "归园田居"),

    # 曹植
    ("曹植", "192", "东武阳", 115.5, 36.0, "出生", None, "生于东武阳"),
    ("曹植", "210", "邺城", 114.5, 36.3, "居住", 3650, "居邺城、建铜雀台"),
    ("曹植", "220", "洛阳", 112.45, 34.62, "政治", 365, "曹丕即位"),
    ("曹植", "226", "陈郡", 114.8, 33.6, "贬谪", 1825, "封陈王，郁郁而终"),
    ("曹植", "232", "陈郡", 114.8, 33.6, "去世", None, "病逝"),

    # 屈原
    ("屈原", "前340", "秭归", 110.66, 31.06, "出生", None, "生于楚国丹阳"),
    ("屈原", "前318", "郢都", 112.2, 30.4, "仕宦", 3650, "任楚怀王左徒"),
    ("屈原", "前296", "汉北", 112.0, 31.5, "贬谪", 365, "第一次流放汉北"),
    ("屈原", "前286", "江南", 113.0, 28.0, "贬谪", 2920, "第二次流放江南"),
    ("屈原", "前278", "汨罗", 113.08, 28.80, "去世", None, "投汨罗江殉国"),
]


async def main():
    async with async_session_factory() as session:
        # 1. 扩充诗人
        added_poets = 0
        for row in EXTRA_POETS:
            r = await session.execute(select(Poet).where(Poet.name == row["name"]))
            if r.scalar_one_or_none():
                continue
            p = Poet(name=row["name"], birth_year=row["birth_year"],
                     death_year=row["death_year"], dynasty=row["dynasty"],
                     tags=row["tags"], created_at=utcnow())
            session.add(p)
            added_poets += 1
        await session.flush()
        print(f"新增诗人: {added_poets}")

        # 2. 添加作品到新增诗人
        poet_map = {}
        for row in EXTRA_POETS:
            r = await session.execute(select(Poet).where(Poet.name == row["name"]))
            p = r.scalar_one_or_none()
            if p:
                poet_map[row["name"]] = p

        added_poems = 0
        for name, works in CLASSIC_WORKS.items():
            p = poet_map.get(name)
            if not p:
                continue
            for title, content in works:
                r = await session.execute(
                    select(Poetry).where(Poetry.title == title, Poetry.author_id == p.poet_id)
                )
                if r.scalar_one_or_none():
                    continue
                poem = Poetry(title=title, author_id=p.poet_id, dynasty=p.dynasty,
                              content=content, genre="古风", created_at=utcnow())
                session.add(poem)
                await session.flush()
                feat = PoetryFeature(poetry_id=poem.poetry_id,
                                     mood_tags=["古风", "经典"] if p.dynasty in ("先秦", "汉") else ["经典"])
                session.add(feat)
                added_poems += 1
        print(f"新增诗词: {added_poems}")

        # 3. 轨迹
        added_traj = 0
        for row in NEW_TRAJECTORIES:
            poet_name = row[0]
            r = await session.execute(select(Poet).where(Poet.name == poet_name))
            p = r.scalar_one_or_none()
            if not p:
                continue
            r2 = await session.execute(
                select(PoetTrajectory).where(
                    PoetTrajectory.poet_id == p.poet_id,
                    PoetTrajectory.event_year == row[1],
                )
            )
            if r2.scalar_one_or_none():
                continue
            t = PoetTrajectory(poet_id=p.poet_id, event_year=row[1],
                               ancient_place=row[2], wgs84_lon=row[3], wgs84_lat=row[4],
                               event_type=row[5], stay_duration_days=row[6], source=row[7],
                               created_at=utcnow())
            session.add(t)
            added_traj += 1
        print(f"新增轨迹: {added_traj}")

        # 4. 地名沿革
        added_changes = 0
        for name, year, old, new, src in PLACE_CHANGES:
            r = await session.execute(select(PlaceName).where(PlaceName.ancient_name == name))
            place = r.scalar_one_or_none()
            if not place:
                continue
            r2 = await session.execute(
                select(PlaceNameChange).where(
                    PlaceNameChange.place_id == place.place_id,
                    PlaceNameChange.change_year == year,
                )
            )
            if r2.scalar_one_or_none():
                continue
            c = PlaceNameChange(place_id=place.place_id, change_year=year,
                                old_name=old, new_name=new, source=src)
            session.add(c)
            added_changes += 1
        print(f"新增地名沿革: {added_changes}")

        # 5. 交游预计算（仅示例，对知名同时代诗人两两计算）
        # 这里只给几个已知有交游关系的诗人对
        added_enc = 0
        pairs = [
            ("李白", "杜甫", "744", "745", "洛阳"),
            ("李白", "孟浩然", "730", "730", "长安"),
            ("白居易", "元稹", "800", "830", "长安"),
            ("苏轼", "黄庭坚", "1080", "1100", "汴京"),
            ("苏轼", "王安石", "1070", "1085", "金陵"),
        ]
        for a, b, ys, ye, pl in pairs:
            pa = (await session.execute(select(Poet).where(Poet.name == a))).scalar_one_or_none()
            pb = (await session.execute(select(Poet).where(Poet.name == b))).scalar_one_or_none()
            if not pa or not pb:
                continue
            # 计算概率
            from app.services.spatial import SpatialQueryService
            svc = SpatialQueryService(session)
            result = await svc.calculate_encounter_probability(str(pa.poet_id), str(pb.poet_id))
            enc = PoetEncounter(
                poet_a_id=pa.poet_id, poet_b_id=pb.poet_id,
                overlap_start_year=ys, overlap_end_year=ye,
                encounter_probability=result["probability"],
                period_overlap_days=365 * (int(ye) - int(ys)),
                created_at=utcnow(),
            )
            session.add(enc)
            added_enc += 1
        print(f"新增交游预计算: {added_enc}")

        await session.commit()
        print("\n✅ 数据补齐完成！")


if __name__ == "__main__":
    asyncio.run(main())
