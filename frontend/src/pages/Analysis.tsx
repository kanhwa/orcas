import { useState } from "react";
import { Card } from "../components/ui/Card";
import InfoTip from "../components/InfoTip";
import Screening from "./Screening";
import MetricRanking from "./MetricRanking";

type Tab = "screening" | "metric-ranking";

export default function Analysis() {
  const [activeTab, setActiveTab] = useState<Tab>("screening");

  const screeningInfo =
    "Choose a year, add multiple filters, then run screening (AND logic). " +
    "Use Data Hint to pick realistic thresholds (range/median). " +
    "Results show tickers that satisfy all conditions.";

  const rankingInfo =
    "Single-Year Top N ranks banks for one selected year. " +
    "Multi-Year Panel picks Top N by the end year, then shows the same banks across the full year range.";

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <Card>
        <div className="flex border-b border-[rgb(var(--color-border))]">
          <button
            type="button"
            onClick={() => setActiveTab("screening")}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "screening"
                ? "text-[rgb(var(--color-primary))]"
                : "text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔍</span>
              Screening
              <InfoTip content={screeningInfo} />
            </span>
            {activeTab === "screening" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("metric-ranking")}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "metric-ranking"
                ? "text-[rgb(var(--color-primary))]"
                : "text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🏆</span>
              Metric Ranking
              <InfoTip content={rankingInfo} />
            </span>
            {activeTab === "metric-ranking" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]" />
            )}
          </button>
        </div>
      </Card>

      {/* Tab Content */}
      <div>{activeTab === "screening" ? <Screening /> : <MetricRanking />}</div>
    </div>
  );
}
