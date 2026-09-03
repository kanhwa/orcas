import os
import re

files_to_patch = [
    "frontend/src/pages/Scoring.tsx",
    "frontend/src/pages/ComparePage.tsx",
    "frontend/src/pages/Simulation.tsx",
    "frontend/src/pages/Screening.tsx",
    "frontend/src/pages/MetricRanking.tsx",
    "frontend/src/pages/Historical.tsx"
]

split_button_template = """<div className="flex rounded-md shadow-sm relative">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"
                  onClick={{onClick}}
                  disabled={{isLoading}}
                >
                  {{isLoading}} ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
                </Button>
                <div className="relative flex items-stretch">
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}
                    className="appearance-none bg-purple-700 hover:bg-purple-800 text-white rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l border-purple-500 font-medium"
                    disabled={{isLoading}}
                  >
                    <option value="Indonesian">Indonesian</option>
                    <option value="English">English</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                </div>
              </div>"""

for filepath in files_to_patch:
    with open(filepath, "r") as f:
        content = f.read()

    # Find the AI Loading state to inject aiLanguage next to it
    if "const [aiLoading, setAiLoading]" in content:
        content = content.replace("const [aiLoading, setAiLoading] = useState(false);", 'const [aiLoading, setAiLoading] = useState(false);\n  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");')
        is_loading_var = "aiLoading"
    elif "const [aiAnalysisLoading, setAiAnalysisLoading]" in content:
        content = content.replace("const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);", 'const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);\n  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");')
        is_loading_var = "aiAnalysisLoading"
    elif "const [rankingAiLoading, setRankingAiLoading]" in content: # Scoring also has ranking AI
        content = content.replace("const [rankingAiLoading, setRankingAiLoading] = useState(false);", 'const [rankingAiLoading, setRankingAiLoading] = useState(false);\n  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");')
        is_loading_var = "rankingAiLoading" # Will handle Scoring specifically

    # Update API calls to use aiLanguage instead of "English"
    content = content.replace('"English")', 'aiLanguage)')
    content = content.replace("'English')", 'aiLanguage)')
    # For scoring, it uses body: JSON.stringify(scorecard). We need to pass language.
    if filepath.endswith("Scoring.tsx"):
        content = content.replace("body: JSON.stringify(scorecard)", "body: JSON.stringify({ scorecard, language: aiLanguage })")
        content = content.replace("body: JSON.stringify({ result: rankResult })", "body: JSON.stringify({ result: rankResult, language: aiLanguage })")

    # Replace the button
    button_regex = r'<Button[^>]*onClick=\{([^}]+)\}[^>]*disabled=\{([^}]+)\}[^>]*>.*?Explain with Orcas AI.*?<\/Button>'
    
    def replace_btn(match):
        onclick = match.group(1)
        disabled = match.group(2)
        btn_html = split_button_template.replace("{{onClick}}", onclick).replace("{{isLoading}}", disabled)
        return btn_html

    content = re.sub(button_regex, replace_btn, content, flags=re.DOTALL)
    
    with open(filepath, "w") as f:
        f.write(content)

