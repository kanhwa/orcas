with open("frontend/src/pages/Scoring.tsx", "r") as f:
    content = f.read()

# Blueprint 5
content = content.replace('{tab !== "ranking" && <option value="custom">Custom</option>}', '<option value="custom">Custom</option>')
content = content.replace("""  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (next === "ranking" && weightProfile === "custom") {
      setWeightProfile("default");
      setSelectedWeightTemplateId("");
    }
  };""", """  const handleTabChange = (next: Tab) => {
    setTab(next);
  };""")

btn_block1 = """          <div className="flex flex-wrap items-center gap-3">
            <Button variant="report" onClick={openScorecardSave} disabled={aiAnalysisLoading}>
              Save to Reports
            </Button>
            {saveMessage && (
              <span className="text-xs text-green-700">{saveMessage}</span>
            )}"""
btn_repl1 = """          <div className="flex flex-wrap items-center gap-3">
            <Button variant="report" onClick={openScorecardSave} disabled={aiAnalysisLoading}>
              Save to Reports
            </Button>
            {canSaveTemplate && (
              <>
                <Button variant="secondary" onClick={openSaveTemplateModal}>
                  Save as Template
                </Button>
                {templateSaveSuccess && (
                  <span className="text-xs text-green-700">
                    {templateSaveSuccess}
                  </span>
                )}
              </>
            )}
            {saveMessage && (
              <span className="text-xs text-green-700">{saveMessage}</span>
            )}"""
content = content.replace(btn_block1, btn_repl1)

btn_block2 = """          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSaveRun}
              disabled={weightProfileBlocked || rankingAiLoading}
              variant="report"
            >
              Save to Reports
            </Button>
            {saveMessage && (
              <span className="text-xs text-green-700">{saveMessage}</span>
            )}"""
btn_repl2 = """          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSaveRun}
              disabled={weightProfileBlocked || rankingAiLoading}
              variant="report"
            >
              Save to Reports
            </Button>
            {canSaveTemplate && (
              <>
                <Button variant="secondary" onClick={openSaveTemplateModal}>
                  Save as Template
                </Button>
                {templateSaveSuccess && (
                  <span className="text-xs text-green-700">
                    {templateSaveSuccess}
                  </span>
                )}
              </>
            )}
            {saveMessage && (
              <span className="text-xs text-green-700">{saveMessage}</span>
            )}"""
content = content.replace(btn_block2, btn_repl2)

del_block = """          {canSaveTemplate && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={openSaveTemplateModal}>
                Save as Template
              </Button>
              {templateSaveSuccess && (
                <span className="text-xs text-green-700">
                  {templateSaveSuccess}
                </span>
              )}
            </div>
          )}"""
content = content.replace(del_block, "")

# Blueprint 2 for Scoring.tsx
content = content.replace('const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);', 'const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);\n  const [aiLanguage, setAiLanguage] = useState<"Indonesian" | "English">("Indonesian");')

ai_btn_ranking = """            <div className="ml-auto">
              <Button 
                onClick={() => handleGenerateRankingAi(
                  rankFilterType === "all" ? scorecard 
                  : rankFilterType === "top" ? scorecard.slice(0, rankFilterCount)
                  : scorecard.slice(-rankFilterCount)
                )}
                disabled={weightProfileBlocked || rankingAiLoading || !scorecard?.length}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {rankingAiLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
              </Button>
            </div>"""
ai_repl_ranking = """            <div className="ml-auto flex rounded-md shadow-sm">
              <Button 
                onClick={() => handleGenerateRankingAi(
                  rankFilterType === "all" ? scorecard 
                  : rankFilterType === "top" ? scorecard.slice(0, rankFilterCount)
                  : scorecard.slice(-rankFilterCount)
                )}
                disabled={weightProfileBlocked || rankingAiLoading || !scorecard?.length}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"
              >
                {rankingAiLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
              </Button>
              <select
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}
                className="appearance-none bg-purple-700 hover:bg-purple-800 text-white rounded-r-md pl-3 pr-4 py-2 text-sm focus:outline-none cursor-pointer border-l border-purple-500 font-medium"
                disabled={weightProfileBlocked || rankingAiLoading || !scorecard?.length}
              >
                <option value="Indonesian">Indonesian</option>
                <option value="English">English</option>
              </select>
            </div>"""
content = content.replace(ai_btn_ranking, ai_repl_ranking)

ai_btn_scorecard = """            <div className="ml-auto">
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleGenerateAiAnalysis}
                disabled={aiAnalysisLoading}
              >
                {aiAnalysisLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
              </Button>
            </div>"""
ai_repl_scorecard = """            <div className="ml-auto flex rounded-md shadow-sm">
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-r-none pr-3"
                onClick={handleGenerateAiAnalysis}
                disabled={aiAnalysisLoading}
              >
                {aiAnalysisLoading ? <span className="animate-pulse">Orcas is thinking...</span> : "Explain with Orcas AI"}
              </Button>
              <select
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value as "Indonesian" | "English")}
                className="appearance-none bg-purple-700 hover:bg-purple-800 text-white rounded-r-md pl-3 pr-4 py-2 text-sm focus:outline-none cursor-pointer border-l border-purple-500 font-medium"
                disabled={aiAnalysisLoading}
              >
                <option value="Indonesian">Indonesian</option>
                <option value="English">English</option>
              </select>
            </div>"""
content = content.replace(ai_btn_scorecard, ai_repl_scorecard)

# API modification
content = content.replace("body: JSON.stringify(scorecard)", "body: JSON.stringify({ scorecard, language: aiLanguage })")
content = content.replace("body: JSON.stringify({ result: rankResult })", "body: JSON.stringify({ result: rankResult, language: aiLanguage })")

with open("frontend/src/pages/Scoring.tsx", "w") as f:
    f.write(content)
