import re

with open("frontend/src/pages/Scoring.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r'<select\s+value=\{aiLanguage\}\s+onChange=\{[^}]+\}\s+className="appearance-none bg-purple[^"]*"',
    r'<select\n                value={aiLanguage}\n                onChange={(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}\n                className="appearance-none bg-purple-600 hover:bg-purple-700 text-white rounded-l-none rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l-0 font-medium h-full min-h-[36px]"',
    content,
    flags=re.DOTALL
)

with open("frontend/src/pages/Scoring.tsx", "w") as f:
    f.write(content)
