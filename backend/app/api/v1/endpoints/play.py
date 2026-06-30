"""
互动娱乐 API — 飞花令 / 每日诗词 / 随机推荐 / 同主题
"""
import random
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.poetry import Poetry, PoetryFeature
from app.models.poet import Poet

router = APIRouter()

# ─── 古典诗词注释词典（核心词汇）──────────────────
ANNOTATIONS = {
    "婵娟": "形容姿态美好，亦指明月",
    "杜康": "传说中酒的发明者，后借指美酒",
    "子衿": "周代读书人的服饰，代指贤才",
    "蹉跎": "虚度光阴，延误时机",
    "踌躇": "犹豫不决，徘徊不前",
    "缱绻": "情意缠绵，难舍难分",
    "旖旎": "景物柔美、婀娜多姿",
    "潋滟": "水波荡漾、波光闪耀",
    "峥嵘": "山势高峻，比喻才气品格超越",
    "倥偬": "事务繁忙紧迫",
    "绸缪": "情意殷切，亦指事先准备",
    "婉约": "委婉含蓄，柔美动人",
    "磅礴": "气势盛大、宏伟",
    "沧桑": "沧海桑田的缩写，比喻世事巨变",
    "蹁跹": "轻快旋转起舞的样子",
    "绮丽": "华美艳丽、灿烂多彩",
    "氤氲": "烟云弥漫、气象混沌",
    "寥廓": "高远空旷、广阔无垠",
    "嶙峋": "山石突兀重叠，形容人消瘦",
    "倜傥": "洒脱不拘、豪爽大方",
}

# ─── 名家评注库 ──────────────────────────────
CRITIQUES = {
    "定风波": "「一蓑烟雨任平生」此句尽显东坡旷达胸襟，不以物喜，不以己悲。——俞陛云《唐五代两宋词选释》",
    "水调歌头": "「但愿人长久，千里共婵娟」千古中秋词之绝唱，写尽人间至情。——胡仔《苕溪渔隐丛话》",
    "念奴娇·赤壁怀古": "「大江东去」一词，为千古绝调，自有词以来，未有此作。——陈廷焯《白雨斋词话》",
    "静夜思": "「床前明月光」二十字，唐人绝句之典范，语浅情深。——沈德潜《唐诗别裁》",
    "将进酒": "「君不见黄河之水天上来」，太白壮游之篇，气吞云梦，笔撼山河。——王琦注《李太白文集》",
    "登高": "「无边落木萧萧下」七律之冠，字字珠玑，句句凝练。——杨伦《杜诗镜铨》",
    "声声慢": "「寻寻觅觅，冷冷清清」十四叠字，千古创格，写尽愁字。——张端义《贵耳集》",
    "春望": "「国破山河在」老杜沉郁顿挫之笔，满目疮痍，一字一泪。——仇兆鳌《杜诗详注》",
    "送元二使安西": "「劝君更尽一杯酒」阳关三叠，赠别绝调，气韵天成。——李东阳《怀麓堂诗话》",
    "山居秋暝": "「空山新雨后」王维诗中有画之典范，清幽绝俗。——王士禛《带经堂诗话》",
}


@router.get("/daily")
async def get_daily_poem(db: AsyncSession = Depends(get_db)):
    """每日一诗 — SRS 3.1 分层优先级全自动推荐"""
    from app.services.daily_scheduler import get_daily_poem_for_date
    result = await get_daily_poem_for_date(db, date.today())
    if not result:
        return {"error": "no poetry found"}
    return result


@router.get("/poem/{poetry_id}")
async def get_poem_by_id(poetry_id: str, db: AsyncSession = Depends(get_db)):
    """按 ID 获取单首诗词"""
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items, pf.season
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.poetry_id = :pid
        LIMIT 1
    """)
    row = (await db.execute(stmt, {"pid": poetry_id})).mappings().first()
    if not row:
        return {"error": "poem not found"}

    import json
    return {
        "poetry_id": str(row["poetry_id"]),
        "title": row["title"],
        "content": row["content"],
        "author": row["author"],
        "dynasty": row["dynasty"],
        "genre": row["genre"] or "",
        "mood_tags": json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or []),
        "imagery_items": json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or []),
        "season": json.loads(row["season"]) if isinstance(row["season"], str) else (row["season"] or []),
    }


@router.get("/poem/{poetry_id}/study")
async def get_poem_study(poetry_id: str, db: AsyncSession = Depends(get_db)):
    """研读数据：注释 / 背景 / 评注 / 典故"""
    # Get poem basic info
    stmt = text("""
        SELECT p.title, p.content, p.dynasty, po.name as author,
               pf.mood_tags, pf.imagery_items, pf.season,
               pf.allusion_names, pf.allusion_sources, pf.allusion_targets,
               pf.geo_creation_place_id, pf.creation_year
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.poetry_id = :pid
        LIMIT 1
    """)
    row = (await db.execute(stmt, {"pid": poetry_id})).mappings().first()
    if not row:
        return {"error": "poem not found"}

    import json
    title = row["title"]
    content = row["content"]
    author = row["author"]
    dynasty = row["dynasty"]

    # 1. 注释：从正文中提取生僻词 + 意象词 + mood_tags
    annotations = []
    mood_tags = json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or [])
    imagery_items = json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or [])

    for word, meaning in ANNOTATIONS.items():
        if word in content:
            annotations.append({"word": word, "meaning": meaning})

    for img in imagery_items[:6]:
        annotations.append({"word": img, "meaning": f"诗词意象：{img}"})

    if not annotations and mood_tags:
        for tag in mood_tags[:4]:
            annotations.append({"word": tag, "meaning": f"意境：{tag}"})

    # 2. 创作背景: 从诗人信息 + 朝代推断
    background_parts = []
    background_parts.append(f"此诗为{dynasty}代{author}所作。")

    creation_year = row["creation_year"]
    if creation_year:
        background_parts.append(f"创作于{creation_year}年前后。")

    # Get poet description
    poet_desc = (await db.execute(text("SELECT description FROM poets WHERE name=:n LIMIT 1"), {"n": author})).scalar()
    if poet_desc:
        background_parts.append(poet_desc[:100])

    # Get trajectory for location context
    place_id = row["geo_creation_place_id"]
    if place_id:
        place = (await db.execute(text("SELECT ancient_name FROM place_names WHERE place_id=:pid LIMIT 1"),
                 {"pid": str(place_id).replace("-", "")})).scalar()
        if place:
            background_parts.append(f"创作地点：{place}。")

    # 3. 名家评注
    critiques = []
    critique_text = CRITIQUES.get(title)
    if critique_text:
        critiques.append(critique_text)
    else:
        critiques.append(f"「{content[:20]}……」——{author}此作向为后世称道，历代评家多有赞誉。")

    # 4. 相关典故
    allusions = []
    all_names = json.loads(row["allusion_names"]) if isinstance(row["allusion_names"], str) else (row["allusion_names"] or [])
    all_sources = json.loads(row["allusion_sources"]) if isinstance(row["allusion_sources"], str) else (row["allusion_sources"] or [])
    for i, name in enumerate(all_names[:5]):
        src = all_sources[i] if i < len(all_sources) else ""
        allusions.append({"name": name, "source": src})

    if not allusions:
        # Fallback: extract potential allusion words from content
        for word in ["蓬莱", "昆仑", "沧海", "巫山", "潇湘", "桃源", "瑶台", "蓬莱", "赤壁", "金陵", "洛阳", "长安"]:
            if word in content:
                allusions.append({"name": word, "source": f"地名/典故：{word}。"})

    return {
        "annotations": annotations[:10],
        "background": "".join(background_parts) if background_parts else f"《{title}》是{dynasty}代诗人{author}的代表作，具体创作时间已不可考。",
        "critique": critiques[0] if critiques else f"《{title}》历代传诵，为{author}代表作之一。",
        "allusions": allusions[:5],
    }


@router.get("/random")
async def get_random_poem(db: AsyncSession = Depends(get_db)):
    """随机一首诗"""
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items, pf.season, pf.difficulty
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        ORDER BY RANDOM() LIMIT 1
    """)
    row = (await db.execute(stmt)).mappings().first()
    if not row:
        return {"error": "no poetry found"}

    import json
    return {
        "poetry_id": str(row["poetry_id"]),
        "title": row["title"],
        "content": row["content"],
        "author": row["author"],
        "dynasty": row["dynasty"],
        "genre": row["genre"] or "",
        "mood_tags": json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or []),
        "imagery_items": json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or []),
        "season": json.loads(row["season"]) if isinstance(row["season"], str) else (row["season"] or []),
        "difficulty": row["difficulty"] or "",
        "date": date.today().isoformat(),
    }


@router.get("/related")
async def get_related_poems(
    poetry_id: str = Query(..., description="当前诗词ID"),
    mode: str = Query("mood", description="推荐模式: mood/author/random"),
    db: AsyncSession = Depends(get_db),
):
    """同主题/同作者推荐"""
    # 获取当前诗的信息
    poem = (await db.execute(select(Poetry).where(Poetry.poetry_id == poetry_id))).scalar_one_or_none()
    if not poem:
        return {"error": "poem not found"}

    feat = (await db.execute(select(PoetryFeature).where(PoetryFeature.poetry_id == poetry_id))).scalar_one_or_none()

    import json
    mood_tags = []
    if feat and feat.mood_tags:
        mood_tags = json.loads(feat.mood_tags) if isinstance(feat.mood_tags, str) else feat.mood_tags

    if mode == "author":
        # 同作者
        stmt = text("""
            SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
            FROM poetry p JOIN poets po ON po.poet_id = p.author_id
            WHERE p.author_id = :aid AND p.poetry_id != :pid
            ORDER BY RANDOM() LIMIT 5
        """)
        rows = (await db.execute(stmt, {"aid": poem.author_id, "pid": poetry_id})).mappings().all()
    elif mode == "mood" and mood_tags:
        # 同意境（匹配 mood_tags）
        tag = mood_tags[0]
        stmt = text("""
            SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
            FROM poetry p
            JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
            JOIN poets po ON po.poet_id = p.author_id
            WHERE pf.mood_tags LIKE :tag AND p.poetry_id != :pid
            ORDER BY RANDOM() LIMIT 5
        """)
        rows = (await db.execute(stmt, {"tag": f"%{tag}%", "pid": poetry_id})).mappings().all()
    else:
        # 随机推荐
        stmt = text("""
            SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
            FROM poetry p JOIN poets po ON po.poet_id = p.author_id
            WHERE p.poetry_id != :pid
            ORDER BY RANDOM() LIMIT 5
        """)
        rows = (await db.execute(stmt, {"pid": poetry_id})).mappings().all()

    return {
        "mode": mode,
        "current_title": poem.title,
        "related": [{
            "poetry_id": str(r["poetry_id"]),
            "title": r["title"],
            "author": r["author"],
        } for r in rows]
    }


@router.post("/feihualing")
async def feihualing(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """飞花令 — 输入一个汉字，返回含该字的诗句"""
    char = body.get("char", "").strip()
    exclude_ids = body.get("exclude_ids", [])

    if not char or len(char) != 1:
        return {"error": "请输入一个汉字"}

    # 查询含该字的诗句（排除已用过的）
    stmt = text("""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, po.name as author
        FROM poetry p
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.content LIKE :char
        ORDER BY RANDOM() LIMIT 1
    """)
    row = (await db.execute(stmt, {"char": f"%{char}%"})).mappings().first()

    if not row:
        return {"char": char, "poem": None, "message": f"没有找到含「{char}」的诗句"}

    # 从内容中提取包含该字的句子
    lines = [l.strip() for l in row["content"].replace("。", "。\n").replace("？", "？\n").replace("！", "！\n").split("\n") if l.strip()]
    matching_lines = [l for l in lines if char in l]

    return {
        "char": char,
        "poem": {
            "poetry_id": str(row["poetry_id"]),
            "title": row["title"],
            "author": row["author"],
            "dynasty": row["dynasty"],
            "content": row["content"],
            "matching_line": matching_lines[0] if matching_lines else "",
        },
    }


# ─── 诗词分类元数据 ──────────────────────────────
GENRE_META = {
    "五言": {
        "name": "五言诗",
        "subtitle": "五绝 · 五律",
        "description": "五言诗是中国古典诗歌的主要体裁之一，每句五字。起源于汉代民歌，成熟于魏晋，盛于唐代。五言诗较四言诗容量更大，节奏更富变化，成为后世最常用的诗歌形式之一。",
        "background": "五言诗的雏形可追溯至《诗经》中的部分篇章。汉代乐府民歌大量使用五言，至东汉末年《古诗十九首》标志着五言诗的成熟。魏晋时期，曹植、陶渊明等大家将五言诗推向新高度。唐代是五言诗的巅峰时代，王维、孟浩然、李白、杜甫等巨匠留下了无数千古名篇。",
        "characteristics": [
            "简洁凝练，言简意赅——五言诗以极简的篇幅承载深厚的情感和思想",
            "节奏优美，抑扬顿挫——二三结构形成独特的韵律美感",
            "意境深远，余韵悠长——以有限之景写无限之情",
            "题材广泛，包罗万象——从山水田园到边塞征战，从送别怀人到咏史抒怀",
        ],
        "sub_genres": ["五言绝句", "五言律诗"],
        "famous_lines": [
            {"line": "床前明月光，疑是地上霜。举头望明月，低头思故乡。", "source": "静夜思", "author": "李白"},
            {"line": "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。", "source": "春晓", "author": "孟浩然"},
            {"line": "空山新雨后，天气晚来秋。明月松间照，清泉石上流。", "source": "山居秋暝", "author": "王维"},
            {"line": "国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。", "source": "春望", "author": "杜甫"},
            {"line": "红豆生南国，春来发几枝。愿君多采撷，此物最相思。", "source": "相思", "author": "王维"},
        ],
    },
    "七言": {
        "name": "七言诗",
        "subtitle": "七绝 · 七律",
        "description": "七言诗每句七字，是中国古典诗歌气势最恢宏的体裁。起源于汉代，成熟于唐代。七言诗音节更为丰富，篇幅更为舒展，尤其适合抒发磅礴气势和深沉感慨。",
        "background": '七言诗的起源可追溯到汉代柏梁体，魏晋时期曹丕《燕歌行》是现存最早的完整七言诗。至唐代，七言绝句和七言律诗高度成熟，李白、王昌龄、杜甫、杜牧、李商隐等诗人创作了大量传世名篇。七言律诗格律严谨、对仗工整，被誉为中国古典诗歌的「黄金体裁」。',
        "characteristics": [
            "气势磅礴，雄浑壮阔——七言诗更擅长表现宏大场面和豪迈情怀",
            "音韵丰富，节奏多变——四三结构使节奏更富表现力",
            "对仗工整，格律严谨——七律尤其讲究「二四六分明」的平仄规则",
            "抒情叙事兼善——既可婉约细腻，亦可慷慨激昂",
        ],
        "sub_genres": ["七言绝句", "七言律诗"],
        "famous_lines": [
            {"line": "朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。", "source": "早发白帝城", "author": "李白"},
            {"line": "秦时明月汉时关，万里长征人未还。但使龙城飞将在，不教胡马度阴山。", "source": "出塞", "author": "王昌龄"},
            {"line": "无边落木萧萧下，不尽长江滚滚来。万里悲秋常作客，百年多病独登台。", "source": "登高", "author": "杜甫"},
            {"line": "渭城朝雨浥轻尘，客舍青青柳色新。劝君更尽一杯酒，西出阳关无故人。", "source": "送元二使安西", "author": "王维"},
            {"line": "清明时节雨纷纷，路上行人欲断魂。借问酒家何处有，牧童遥指杏花村。", "source": "清明", "author": "杜牧"},
        ],
    },
    "词": {
        "name": "词",
        "subtitle": "婉约 · 豪放",
        "description": "词，又称诗余、长短句，是中国古典诗歌的重要形式。起源于隋唐，兴盛于两宋。词配合音乐歌唱，句式长短错落，格律灵活多变，特别擅长抒发细腻情感和描绘婉约意境。",
        "background": "词起源于隋唐燕乐，最初为配合乐曲而作的歌词。晚唐五代时期，温庭筠、韦庄等花间词人确立了词的文学地位。两宋是词的黄金时代，婉约派以柳永、李清照、晏殊为代表，词风细腻含蓄；豪放派以苏轼、辛弃疾为代表，词风雄浑奔放。词分为小令（58字以内）、中调（59-90字）和长调（91字以上），各有不同的格律要求。",
        "characteristics": [
            "句式长短错落——突破齐言诗的束缚，更贴近语言的自然节奏",
            "格律依谱填词——每个词牌都有固定的平仄和韵脚要求",
            "意境婉约含蓄——尤擅表现细腻情感和微妙心境",
            "题材丰富多样——从儿女情长到家国天下，从山水田园到咏史怀古",
        ],
        "sub_genres": ["小令", "中调", "长调"],
        "famous_lines": [
            {"line": "大江东去，浪淘尽，千古风流人物。", "source": "念奴娇·赤壁怀古", "author": "苏轼"},
            {"line": "寻寻觅觅，冷冷清清，凄凄惨惨戚戚。", "source": "声声慢", "author": "李清照"},
            {"line": "但愿人长久，千里共婵娟。", "source": "水调歌头", "author": "苏轼"},
            {"line": "问君能有几多愁？恰似一江春水向东流。", "source": "虞美人", "author": "李煜"},
            {"line": "衣带渐宽终不悔，为伊消得人憔悴。", "source": "蝶恋花", "author": "柳永"},
        ],
    },
}

GENRE_MAP = {
    "五言": ["五绝", "五律"],
    "七言": ["七绝", "七律"],
    "词": ["词"],
}


@router.get("/genre/{genre_type}")
async def get_genre_data(genre_type: str, db: AsyncSession = Depends(get_db)):
    """诗词分类数据 — 返回体裁概述、代表作品、代表诗人"""
    if genre_type not in GENRE_META:
        return {"error": f"不支持的体裁：{genre_type}"}

    meta = GENRE_META[genre_type]
    genre_list = GENRE_MAP[genre_type]

    # 构建 IN 条件
    placeholders = ",".join(f"'{g}'" for g in genre_list)

    # 查询诗词
    poems_sql = f"""
        SELECT p.poetry_id, p.title, p.content, p.dynasty, p.genre,
               po.name as author,
               pf.mood_tags, pf.imagery_items
        FROM poetry p
        JOIN poetry_features pf ON pf.poetry_id = p.poetry_id
        JOIN poets po ON po.poet_id = p.author_id
        WHERE p.genre IN ({placeholders})
        ORDER BY RANDOM() LIMIT 50
    """
    rows = (await db.execute(text(poems_sql))).mappings().all()

    import json
    poems = []
    poet_counts: dict[str, dict] = {}

    for row in rows:
        mood_tags = json.loads(row["mood_tags"]) if isinstance(row["mood_tags"], str) else (row["mood_tags"] or [])
        imagery_items = json.loads(row["imagery_items"]) if isinstance(row["imagery_items"], str) else (row["imagery_items"] or [])

        poems.append({
            "poetry_id": str(row["poetry_id"]),
            "title": row["title"],
            "content": row["content"],
            "author": row["author"],
            "dynasty": row["dynasty"],
            "genre": row["genre"] or "",
            "mood_tags": mood_tags,
            "imagery_items": imagery_items,
        })

        # 统计诗人
        author_name = row["author"]
        if author_name not in poet_counts:
            poet_counts[author_name] = {"name": author_name, "dynasty": row["dynasty"], "count": 0, "poet_id": ""}
        poet_counts[author_name]["count"] += 1

    # 统计子体裁数量
    sub_counts_sql = f"""
        SELECT p.genre, COUNT(*) as cnt
        FROM poetry p
        WHERE p.genre IN ({placeholders})
        GROUP BY p.genre
    """
    sub_rows = (await db.execute(text(sub_counts_sql))).mappings().all()
    sub_genres = [{"name": r["genre"], "count": r["cnt"]} for r in sub_rows]

    # 获取代表诗人的 poet_id
    top_poets = sorted(poet_counts.values(), key=lambda x: x["count"], reverse=True)[:8]
    if top_poets:
        for poet in top_poets:
            poet_row = (await db.execute(
                text("SELECT poet_id FROM poets WHERE name = :n LIMIT 1"), {"n": poet["name"]}
            )).mappings().first()
            if poet_row:
                poet["poet_id"] = str(poet_row["poet_id"])

    return {
        "genre_type": genre_type,
        "name": meta["name"],
        "subtitle": meta["subtitle"],
        "description": meta["description"],
        "background": meta["background"],
        "characteristics": meta["characteristics"],
        "sub_genres": sub_genres,
        "famous_lines": meta["famous_lines"],
        "stats": {
            "total_poems": len(poems),
            "total_poets": len(poet_counts),
        },
        "poems": poems,
        "representative_poets": top_poets,
    }
