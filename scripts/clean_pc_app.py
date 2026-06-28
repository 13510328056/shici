"""Clean H5 mobile code from App.tsx"""
import re

with open('frontend/pc/src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove or fix specific lines
new_lines = []
skip_drawer_block = False
for i, line in enumerate(lines):
    # Skip lines containing specific patterns
    if 'useResponsive' in line and 'import' in line:
        continue
    if "const { isMobile } = useResponsive()" in line:
        continue
    if "const [drawerOpen, setDrawerOpen]" in line:
        continue
    if 'TourismPanel' in line and 'import' in line:
        continue
    if 'DailyCard' in line and 'import' in line:
        continue
    if 'FeihualingPanel' in line and 'import' in line:
        continue
    if '<DailyCard />' in line:
        continue
    if 'poetry-overlay' in line:
        continue
    if '<TourismPanel' in line:
        continue
    if '<FeihualingPanel' in line:
        continue
    if 'isMobile={isMobile}' in line:
        # Remove isMobile prop, keep the rest
        line = line.replace(' isMobile={isMobile}', '')

    # Fix sidebar line - remove className with isMobile
    if 'poetry-drawer' in line:
        line = line.replace(' className={isMobile ? `poetry-drawer${drawerOpen ? \' open\' : \'\'}` : \'\'}', '')

    # Fix container line
    if '...(isMobile ? { display:' in line:
        line = '    <div style={ST.container}>\n'

    # Skip hamburger button block
    if 'poetry-hamburger' in line:
        skip_drawer_block = True
        continue
    if skip_drawer_block:
        if '</button>' in line:
            skip_drawer_block = False
        elif '})()' in line or ')}' in line:
            skip_drawer_block = False
        continue

    new_lines.append(line)

with open('frontend/pc/src/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Cleaned App.tsx")
