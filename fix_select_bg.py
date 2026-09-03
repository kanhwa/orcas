import re

files_to_patch = [
    "frontend/src/pages/Scoring.tsx",
    "frontend/src/pages/ComparePage.tsx",
    "frontend/src/pages/Simulation.tsx",
    "frontend/src/pages/Screening.tsx",
    "frontend/src/pages/MetricRanking.tsx",
    "frontend/src/pages/Historical.tsx"
]

for filepath in files_to_patch:
    with open(filepath, "r") as f:
        content = f.read()

    # Update Button className to remove border-r and rounded-r
    content = re.sub(
        r'className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none[^"]*"',
        r'className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none border-r border-purple-500 pr-3 focus:ring-0"',
        content
    )

    # Update Select className to perfectly match bg-purple-600
    content = re.sub(
        r'<select\s+value=\{aiLanguage\}[^>]*className="appearance-none bg-purple[^"]*"',
        r'<select\n                value={aiLanguage}\n                onChange={(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}\n                className="appearance-none bg-purple-600 hover:bg-purple-700 text-white rounded-l-none rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l-0 font-medium h-full min-h-[36px]"',
        content
    )

    # Add background to options just in case
    content = content.replace('<option value="Indonesian">Indonesian</option>', '<option className="bg-purple-600 text-white" value="Indonesian">Indonesian</option>')
    content = content.replace('<option value="English">English</option>', '<option className="bg-purple-600 text-white" value="English">English</option>')

    with open(filepath, "w") as f:
        f.write(content)

