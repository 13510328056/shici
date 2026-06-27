"""Import Song ci poetry"""
import sys, os, json, asyncio, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./poetry_space_dev.db"

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
engine = create_async_engine("sqlite+aiosqlite:///./poetry_space_dev.db", echo=False)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
from app.core.compat import utcnow
from app.models.poet import Poet
from app.models.poetry import Poetry as Poem

SRC = r"E:\PythonPrj\GSC\chinese-poetry\宋词"

async def main():
    cache = {}
    total = 0
    t0 = time.time()
    files = sorted(f for f in os.listdir(SRC) if f.startswith("ci.song.") and f.endswith(".json"))
    print(f"CI files: {len(files)}", flush=True)

    async with Session() as s:
        for fi, fn in enumerate(files):
            with open(os.path.join(SRC, fn), "r", encoding="utf-8") as f:
                data = json.load(f)
            for p in data:
                author = (p.get("author") or "佚名").strip()
                ck = f"宋:{author}"
                poet = cache.get(ck)
                if not poet:
                    r = await s.execute(select(Poet).where(Poet.name == author, Poet.dynasty == "宋"))
                    poet = r.scalar_one_or_none()
                    if not poet:
                        poet = Poet(name=author, dynasty="宋", created_at=utcnow())
                        s.add(poet)
                        await s.flush()
                    cache[ck] = poet
                rhythmic = p.get("rhythmic", "")
                raw_title = p.get("title", "无题") or "无题"
                title = f"{rhythmic}·{raw_title}" if rhythmic else raw_title
                content = "".join(p.get("paragraphs") or [])
                if not content:
                    continue
                r = await s.execute(
                    select(Poem).where(Poem.title.like(f"%{raw_title[:10]}%"), Poem.author_id == poet.poet_id)
                )
                if r.scalar_one_or_none():
                    continue
                s.add(Poem(title=title, author_id=poet.poet_id, dynasty="宋", content=content, genre="词", created_at=utcnow()))
                total += 1
                if total % 200 == 0:
                    await s.commit()
                    print(f"  {total}...", flush=True)
            cache.clear()
        await s.commit()
        cnt = (await s.execute(sa_func.count()).select_from(Poem)).scalar()
        print(f"CI OK: {total} added, total poems: {cnt}, time: {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
