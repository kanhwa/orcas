import re

with open("frontend/src/pages/Scoring.tsx", "r") as f:
    content = f.read()

# 1. Update canSaveTemplate
old_can_save = """  const canSaveTemplate = useMemo(
    () =>
      !!(
        scorecard &&
        lastScorecardProfile === "custom" &&
        lastCustomWeightsPayload &&
        !customWeightsInvalid
      ),
    [
      customWeightsInvalid,
      lastCustomWeightsPayload,
      lastScorecardProfile,
      scorecard,
    ]
  );"""
new_can_save = """  const canSaveTemplate = useMemo(
    () =>
      !!(
        weightProfile === "custom" &&
        lastCustomWeightsPayload &&
        !customWeightsInvalid
      ),
    [
      customWeightsInvalid,
      lastCustomWeightsPayload,
      weightProfile,
    ]
  );"""
content = content.replace(old_can_save, new_can_save)

# 2. Add setLastCustomWeightsPayload inside handleRun
old_handle_run_try = """    setRankingPolicyUsed(missingPolicy);
    try {
      const weightPayload = buildWeightPayload();"""
new_handle_run_try = """    setRankingPolicyUsed(missingPolicy);
    try {
      const weightPayload = buildWeightPayload();
      
      if (weightProfile === "custom") {
        const weights_json =
          customScope === "section"
            ? customSectionWeights
            : customMetricWeights;
        setLastCustomWeightsPayload({
          mode: customScope,
          weights: { ...weights_json },
        });
      } else {
        setLastCustomWeightsPayload(null);
      }
      setTemplateSaveSuccess("");
"""
content = content.replace(old_handle_run_try, new_handle_run_try)

with open("frontend/src/pages/Scoring.tsx", "w") as f:
    f.write(content)

