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

    # Make sure we don't have gaps inside the split button
    # Replace Button's className
    content = content.replace(
        'className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"',
        'className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none border-r border-purple-500 pr-3 focus:ring-0"'
    )
    
    # Replace Select's className to have the exact same background color
    content = content.replace(
        'className="appearance-none bg-purple-700 hover:bg-purple-800 text-white rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l border-purple-500 font-medium"',
        'className="appearance-none bg-purple-600 hover:bg-purple-700 text-white rounded-l-none rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l-0 font-medium h-full min-h-[36px]"'
    )

    with open(filepath, "w") as f:
        f.write(content)

