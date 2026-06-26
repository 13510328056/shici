"""
AI 仿写/扩写/改写服务 — 需求 4.4.6
基于规则引擎 + 意象库重组
"""

import random
from typing import Optional

# ─── 经典诗句模板库（用于仿写生成）─────────────
STYLE_TEMPLATES: dict[str, dict] = {
    '唐诗雄浑': {
        'patterns': [
            '{mountain}千里{view}，{river}万古流',
            '{feature1}{location}连{feature2}，{sky}{scene}n',
            '欲问{object1}何处有，且看{object2}天际流',
        ],
        'mountain': ['高山', '青山', '苍山', '孤峰', '群岳'],
        'river': ['长江', '大河', '沧浪', '碧波', '寒江'],
        'view': ['目送', '遥望', '俯瞰', '极目', '凭栏'],
        'feature1': ['秦关', '汉塞', '边城', '胡天', '大漠'],
        'feature2': ['汉月', '唐风', '戍楼', '烽台', '沙碛'],
        'location': ['万里', '千嶂', '百尺', '九重', '五云'],
        'sky': ['长天', '碧空', '苍昊', '云汉', '层霄'],
        'scene': ['落日', '归雁', '残霞', '暮云', '飞鸢'],
        'object1': ['前路', '归期', '来日', '行处', '去程'],
        'object2': ['白云', '流水', '暮山', '孤帆', '远峰'],
    },
    '宋词婉约': {
        'patterns': [
            '{feeling}无奈{season}{flow}，{mood}几许{object}落',
            '{time}独上{location}，{view}{object}知何处',
            'r记{scene}时候，{feeling1}难自禁，{action}',
        ],
        'feeling': ['多情', '愁绪', '离恨', '相思', '幽怨'],
        'feeling1': ['此情', '别恨', '离愁', '归思', '旧怀'],
        'season': ['春风', '秋雨', '晓寒', '暮暖', '霜晨'],
        'flow': ['吹不去', '洗难尽', '收还起', '散复聚', '来又去'],
        'mood': ['黄昏', '月明', '夜静', '人散', '灯残'],
        'object': ['飞花', '落叶', '垂杨', '帘栊', '阑干'],
        'time': ['昨夜', '今宵', '那日', '当时', '此后'],
        'location': ['西楼', '南浦', '小园', '画阁', '幽窗'],
        'view': ['望尽', '看取', '问遍', '数尽', '倚遍'],
        'scene': ['相逢', '离别', '初见', '重游', '觅句'],
        'action': ['泪暗流', '独倚楼', '懒回头', '强说愁', '酒未休'],
    },
    '边塞豪放': {
        'patterns': [
            '铁马{action1}，{mountain}{action2}万里霜',
            'c吹角{time}，{warrior}千骑{action3}{place}',
            '{feature}j旌旗{view}，{scene}b伴征人故国心',
        ],
        'action1': ['踏冰河', '争驰逐', '嘶风急', '披寒雾', '踏晨霜'],
        'action2': ['连营', '列阵', '横烟', '卷云', '排闼'],
        'mountain': ['关山', '天山', '阴山', '祁连', '贺兰'],
        'time': ['连营夜', '五更寒', '西风急', '暮云低', '晓星沉'],
        'warrior': ['征人', '壮士', '将军', '边卒', '游侠'],
        'action3': ['拥', '卷', '带', '过', '越'],
        'place': ['边城', '戍楼', '关塞', '碛西', '轮台'],
        'feature': ['猎猎', '漫漫', '飒飒', '飘飘', '逶迤'],
        'view': ['照寒沙', '映残阳', '卷长风', '拂雁行', '接天荒'],
        'scene': ['孤城', '烽火', '羌笛', '胡笳', '塞鸿'],
    },
}

# ─── 诗词体裁结构 ──────────────────────────────
GENRE_STRUCTURES = {
    '五绝': {'lines': 4, 'chars': 5},
    '七绝': {'lines': 4, 'chars': 7},
    '五律': {'lines': 8, 'chars': 5},
    '七律': {'lines': 8, 'chars': 7},
}


class RewriteService:
    """仿写/扩写/改写服务"""

    async def rewrite_style(
        self,
        content: str,
        target_style: str = '唐诗雄浑',
        genre: str = '七绝',
    ) -> dict:
        """同风格仿写 — 基于模板+意象生成"""
        style = STYLE_TEMPLATES.get(target_style, STYLE_TEMPLATES['唐诗雄浑'])
        structure = GENRE_STRUCTURES.get(genre, GENRE_STRUCTURES['七绝'])

        lines = []
        for i in range(structure['lines']):
            pattern = random.choice(style['patterns'])
            line = pattern
            # 填充变量
            import re
            for key in set(re.findall(r'\{(\w+)\}', pattern)):
                if key in style:
                    line = line.replace(f'{{{key}}}', random.choice(style[key]))
            # 调整字数
            line = line[:structure['chars']]
            if len(line) < structure['chars']:
                line += '。' + ' ' * (structure['chars'] - len(line))
            lines.append(line.strip())

        return {
            'input_style': target_style,
            'genre': genre,
            'result': '，'.join(lines) + '。',
            'lines': lines,
            'note': f'仿{target_style}风格{genre}',
        }

    async def expand_lines(
        self,
        input_lines: str,
        target_genre: str = '七绝',
    ) -> dict:
        """短句扩写 — 将2句扩展为完整诗"""
        # 提取输入中的意象词
        import re
        words = [c for c in input_lines if '一' <= c <= '鿿']
        if len(words) < 4:
            return {'error': '输入太短，至少需要4个汉字', 'input': input_lines}

        # 取前两个词组作为意象
        imagery_pool = words[:6]
        structure = GENRE_STRUCTURES.get(target_genre, GENRE_STRUCTURES['七绝'])
        lines = []

        for i in range(structure['lines']):
            if i == 0:
                line = f'{imagery_pool[0]}ing{imagery_pool[1]}{imagery_pool[2]}'
            elif i == structure['lines'] - 1:
                line = f'{imagery_pool[-1]}is{imagery_pool[-2]}{imagery_pool[-3]}'
            else:
                line = f'{random.choice(imagery_pool)}{random.choice(imagery_pool)}{random.choice(imagery_pool)}'
            # Trim
            if len(line) > structure['chars']:
                line = line[:structure['chars']]
            lines.append(line)

        return {
            'input': input_lines,
            'genre': target_genre,
            'result': '，'.join(lines) + '。',
            'lines': lines,
        }

    async def convert_genre(
        self,
        content: str,
        from_genre: str = '七绝',
        to_genre: str = '七律',
    ) -> dict:
        """体裁互转"""
        # 简单实现：拆句→按目标体裁重组
        import re
        raw = re.sub(r'[，。！？、]', '\n', content)
        original_lines = [l.strip() for l in raw.split('\n') if l.strip()]

        from_struct = GENRE_STRUCTURES.get(from_genre, GENRE_STRUCTURES['七绝'])
        to_struct = GENRE_STRUCTURES.get(to_genre, GENRE_STRUCTURES['七律'])

        new_lines = list(original_lines)

        if from_struct['lines'] < to_struct['lines']:
            # 扩写：添加中间句
            while len(new_lines) < to_struct['lines']:
                # 找到最长的句子的位置，在其后复制一行
                mid = len(new_lines) // 2
                new_lines.insert(mid, new_lines[mid - 1] if mid > 0 else new_lines[0])
        elif from_struct['lines'] > to_struct['lines']:
            # 缩写：删除中间句
            while len(new_lines) > to_struct['lines']:
                mid = len(new_lines) // 2
                new_lines.pop(mid)

        # 调整字数
        new_lines = [l[:to_struct['chars']] if len(l) > to_struct['chars']
                     else l + '…' * (to_struct['chars'] - len(l))
                     for l in new_lines]

        return {
            'from': from_genre,
            'to': to_genre,
            'original': content,
            'result': '，'.join(new_lines) + '。',
            'lines': new_lines,
        }

    async def change_perspective(
        self,
        content: str,
        perspective: str = '隐士',
    ) -> dict:
        """视角改写"""
        # 视角词汇映射
        perspectives = {
            '游子': {'prefix': '远游', 'names': ['行客', '游子', '旅人', '孤客', '征客']},
            '隐士': {'prefix': '幽居', 'names': ['山人', '隐者', '野老', '逸士', '幽人']},
            '征人': {'prefix': '戍边', 'names': ['征夫', '戍卒', '边士', '军卒', '兵侠']},
            '闺妇': {'prefix': '深闺', 'names': ['思妇', '闺人', '怨女', '娇娥', '佳人']},
        }

        p = perspectives.get(perspective, perspectives['隐士'])
        name = random.choice(p['names'])

        # 处理内容：替换第一人称相关词汇
        replaced = content
        replacements = {
            '我': name, '吾': name, '余': name,
            '身': name, '心': '此心', '梦': '归梦',
            '愁': '孤愁', '悲': '独悲', '思': '遥思',
            '来': '归来', '去': '归去', '行': '远行',
        }
        for old, new in replacements.items():
            replaced = replaced.replace(old, new)

        return {
            'perspective': perspective,
            'character': name,
            'original': content,
            'result': replaced,
        }
