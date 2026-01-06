import { useState } from "react";
import { Card } from "../components/ui/Card";
import Screening from "./Screening";
import MetricRanking from "./MetricRanking";

type Tab = "screening" | "metric-ranking";

export default function Analysis() {
  const [activeTab, setActiveTab] = useState<Tab>("screening");

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
            </span>
            {activeTab === "metric-ranking" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]" />
            )}
          </button>
        </div>

        {/* Tab Description */}
        <div className="p-4 bg-[rgb(var(--color-surface))]">
          {activeTab === "screening" ? (
            <p className="text-sm text-[rgb(var(--color-text-subtle))]">
              Filter stocks based on multiple metric criteria. Set conditions
              like ROE &gt; 15% AND NPL &lt; 3%.
            </p>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-subtle))]">
              View top N stocks ranked by a specific metric across multiple
              years.
            </p>
          )}
        </div>
      </Card>

      {/* Tab Content */}
      <div>{activeTab === "screening" ? <Screening /> : <MetricRanking />}</div>
    </div>
  );
}
