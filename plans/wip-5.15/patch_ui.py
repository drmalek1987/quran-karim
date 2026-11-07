import io
p = r'D:\Quran App\quran-karim\tools\qa\ui.js'; s = io.open(p, encoding='utf8').read()
old = """    await hzBack(k); return assert(r[0] === '1,112,113' && !r[1] && !r[2] && r[3] === 4 && pick === '112', JSON.stringify([r, pick])); });"""
assert s.count(old) == 1
s = s.replace(old, """    await hzBack(k); return assert(r[0] === '1,112' && !r[1] && !r[2] && r[3] === 4 && pick === '112', JSON.stringify([r, pick])); });   // 5.15 S1: 113 (50% today) is due tomorrow""")
anchor = """  // 5c/5d: the page moves one way only"""
assert s.count(anchor) == 1
new = io.open(r'D:\Quran App\quran-karim\plans\wip-5.15\ui515.js', encoding='utf8').read()
s = s.replace(anchor, new + anchor)
io.open(p, 'w', encoding='utf8', newline='').write(s)
print('ui.js patched')
