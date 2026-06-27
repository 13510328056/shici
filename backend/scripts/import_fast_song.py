"""fast song poetry import with proper flush"""
import sys, os, json, asyncio, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./poetry_space_dev.db"

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
engine = create_async_engine("sqlite+aiosqlite:///./poetry_space_dev.db", echo=False)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
from app.core.compat import utcnow
from app.models.poet import Poet
from app.models.poetry import Poetry

SRC = r"E:\PythonPrj\GSC\chinese-poetry\全唐诗"

async def main():
    cache = {}
    total = 0
    t0 = time.time()
    files = sorted(f for f in os.listdir(SRC) if f.startswith("poet.song.") and f.endswith(".json"))
    print(f"Song files: {len(files)}", flush=True)

    async with Session() as s:
        for fi, fn in enumerate(files):
            fp = os.path.join(SRC, fn)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except:
                continue

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

                title = (p.get("title") or "无题").strip()
                content = "".join(p.get("paragraphs") or [])
                if not content:
                    continue
                r = await s.execute(select(Poetry).where(Poetry.title == title, Poetry.author_id == poet.poet_id))
                if r.scalar_one_or_none():
                    continue
                s.add(Poetry(title=title, author_id=poet.poet_id, dynasty="宋",
                    content=content, genre="诗", created_at=utcnow()))
                total += 1
                if total % 500 == 0:
                    await s.commit()
                    sys.stdout.write(f"\r  {total} ({fi+1}/{len(files)} files, {time.time()-t0:.0f}s)")
                    sys.stdout.flush()
            cache.clear()

        await s.commit()
        print(f"\nDone: {total} poems in {time.time()-t0:.0f}s", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
