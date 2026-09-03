with open("frontend/src/pages/Scoring.tsx", "r") as f:
    content = f.read()

# Remove the state variable
content = content.replace(
    '  const [lastScorecardProfile, setLastScorecardProfile] =\n    useState<WeightProfile | null>(null);',
    ''
)
# Remove the setter where it was called
content = content.replace(
    '      setLastScorecardProfile(weightProfile);\n',
    ''
)

with open("frontend/src/pages/Scoring.tsx", "w") as f:
    f.write(content)
