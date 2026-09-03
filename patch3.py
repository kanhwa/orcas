import sys

with open("frontend/src/pages/SyncData.tsx", "r") as f:
    content = f.read()

# 1. Fix Action Alignment
old_th = '<th className="text-right py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Action</th>'
new_th = '<th className="text-center py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Action</th>'
content = content.replace(old_th, new_th)

old_td = '<td className="py-3 px-4 text-right space-x-4">'
new_td = '<td className="py-3 px-4 text-center space-x-4">'
content = content.replace(old_td, new_td)

# 2. Always show X
old_x = '<span className="text-[10px] text-white leading-none font-bold opacity-0 group-hover:opacity-100">✕</span>'
new_x = '<span className="text-[10px] text-white leading-none font-bold">✕</span>'
content = content.replace(old_x, new_x)

# 3. Clean up .00 decimals in the view
old_parse = """        const parsedRows = rawContent.split('\\n')
            .filter(line => line.trim())
            .map(line => line.split(','));"""
new_parse = """        const parsedRows = rawContent.split('\\n')
            .filter(line => line.trim())
            .map(line => line.split(',').map(cell => cell.replace(/\.0+$/, '')));"""
content = content.replace(old_parse, new_parse)

with open("frontend/src/pages/SyncData.tsx", "w") as f:
    f.write(content)

print("Patch 3 applied")
