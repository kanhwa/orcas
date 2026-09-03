import re

with open("frontend/src/pages/Scoring.tsx", "r") as f:
    content = f.read()

pattern = r'<Button[^>]*onClick=\{\(\) => handleGenerateRankingAi\([^}]+\)\}[^>]*disabled=\{([^}]+)\}[^>]*className="bg-purple-600 hover:bg-purple-700 text-white"\s*>\s*\{[^}]+\s*\?\s*<span[^>]*>[^<]*<\/span>\s*:\s*"Explain with Orcas AI"\s*\}\s*<\/Button>'

def replacer(match):
    disabled = match.group(1)
    
    # Extract onClick exactly as it is in the file
    onclick_match = re.search(r'onClick=\{\(\) => handleGenerateRankingAi\([^}]+\)\}', match.group(0))
    onclick = onclick_match.group(0)
    
    return f"""<div className="flex rounded-md shadow-sm relative">
              <Button 
                {onclick}
                disabled={{{disabled}}}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none border-r border-purple-500 pr-3 focus:ring-0"
              >
                {{rankingAiLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}}
              </Button>
              <select
                value={{aiLanguage}}
                onChange={{(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}}
                className="appearance-none bg-purple-600 hover:bg-purple-700 text-white rounded-l-none rounded-r-md pl-3 pr-8 py-2 text-sm focus:outline-none cursor-pointer border-l-0 font-medium h-full min-h-[36px]"
                disabled={{{disabled}}}
              >
                <option className="bg-purple-600 text-white" value="Indonesian">Indonesian</option>
                <option className="bg-purple-600 text-white" value="English">English</option>
              </select>
            </div>"""

content = re.sub(pattern, replacer, content)

with open("frontend/src/pages/Scoring.tsx", "w") as f:
    f.write(content)
