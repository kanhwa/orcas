with open("frontend/src/pages/Screening.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "const applyFilters = async () => {" in line:
        # Add the AI func right before it
        func = """
  const handleGenerateScreeningAi = async () => {
    if (!result) return;
    setAiLoading(true);
    setAiError("");
    setAiAnalysis("");
    
    try {
      let selectedBanks = result.passed;
      if (selectedBanks.length > 4) {
        selectedBanks = [
          selectedBanks[0],
          selectedBanks[1],
          selectedBanks[Math.floor(selectedBanks.length / 2)],
          selectedBanks[selectedBanks.length - 1]
        ];
      }
      
      const metricsInfo = filters.filter(f => f.metric_name).map(f => {
         const summary = summaries[f.id];
         return {
           metric: f.metric_name,
           hint: summary ? { min: summary.min, median: summary.median, max: summary.max } : null
         };
      });

      const payload = {
        year: selectedYear,
        metrics: metricsInfo,
        banks: selectedBanks
      };

      const { generateScreeningInterpretation } = await import("../services/api");
      const res = await generateScreeningInterpretation(payload, "English");
      setAiAnalysis(res.analysis);
    } catch (err: any) {
      setAiError(err.message || "Failed to generate AI analysis");
    } finally {
      setAiLoading(false);
    }
  };
"""
        # Make sure we don't insert it multiple times
        if "handleGenerateScreeningAi" not in "".join(lines):
            new_lines.append(func)
    
    new_lines.append(line)

content = "".join(new_lines)
with open("frontend/src/pages/Screening.tsx", "w") as f:
    f.write(content)
