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

    # Fix the ternary operator syntax error
    content = re.sub(r'                  ([^}]+)\? <span className="animate-pulse">', r'                  {\1 ? <span className="animate-pulse">', content)
    content = content.replace("disabled=aiLoading", "disabled={aiLoading}")
    content = content.replace("disabled=aiAnalysisLoading", "disabled={aiAnalysisLoading}")
    content = content.replace("disabled=rankingAiLoading", "disabled={rankingAiLoading}")
    content = content.replace("disabled=!canAddMetric", "disabled={!canAddMetric}")
    # Fix the case where disabled had complex logic
    content = re.sub(r'disabled=([^\{][^>]+)', r'disabled={\1}', content)
    
    with open(filepath, "w") as f:
        f.write(content)
