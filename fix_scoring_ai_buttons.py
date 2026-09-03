import re

with open("frontend/src/pages/Scoring.tsx", "r") as f:
    content = f.read()

# Replace the ranking AI button
ranking_pattern = r'<select\s+value=\{aiLanguage\}\s+onChange=\{\(e\) => setAiLanguage[^>]+className="appearance-none[^"]*"[^>]*>\s*<option[^>]*>Indonesian<\/option>\s*<option[^>]*>English<\/option>\s*<\/select>'

# I'll just find the exact block and replace it.
def select_replacer(match):
    original_select = match.group(0)
    return f"""<div className="relative flex items-stretch">
                {original_select}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </div>
              </div>"""

content = re.sub(ranking_pattern, select_replacer, content)

with open("frontend/src/pages/Scoring.tsx", "w") as f:
    f.write(content)
