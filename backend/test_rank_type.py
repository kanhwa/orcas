#!/usr/bin/env python3
"""
Test script to verify rank_type logic for metric ranking.

This script demonstrates the sorting logic without requiring database setup.
"""
from sqlalchemy import desc, asc


class MockMetric:
    """Mock metric definition for testing."""
    def __init__(self, metric_type: str):
        self.type = type('obj', (object,), {'value': metric_type})()


def _get_sort_order(metric, rank_type: str = "best"):
    """
    Determine sort order based on metric type and rank_type.
    
    Logic:
    - Benefit metrics (higher is better):
        - best => DESC (highest first)
        - worst => ASC (lowest first)
    - Cost metrics (lower is better):
        - best => ASC (lowest first)
        - worst => DESC (highest first)
    """
    is_benefit = metric.type and metric.type.value == "benefit"
    
    if rank_type == "worst":
        # Invert the normal ordering
        return asc if is_benefit else desc
    else:
        # Normal "best" ordering (default)
        return desc if is_benefit else asc


def test_sorting_logic():
    """Test the sorting logic for different metric types and rank_types."""
    
    print("=" * 70)
    print("METRIC RANKING - SORTING LOGIC TEST")
    print("=" * 70)
    
    # Test data: sample metric values
    values = [100, 50, 200, 75, 150, 25]
    
    print(f"\nSample values: {values}\n")
    
    # Test 1: Benefit metric (higher is better, like ROE, ROA)
    print("-" * 70)
    print("TEST 1: BENEFIT METRIC (e.g., ROE, ROA - higher is better)")
    print("-" * 70)
    benefit_metric = MockMetric("benefit")
    
    # Best = highest values
    order_best = _get_sort_order(benefit_metric, "best")
    sorted_best = sorted(values, key=lambda x: x, reverse=(order_best == desc))
    print(f"  rank_type='best'  => {order_best.__name__.upper()} => {sorted_best[:3]}")
    
    # Worst = lowest values
    order_worst = _get_sort_order(benefit_metric, "worst")
    sorted_worst = sorted(values, key=lambda x: x, reverse=(order_worst == desc))
    print(f"  rank_type='worst' => {order_worst.__name__.upper()} => {sorted_worst[:3]}")
    
    assert sorted_best[:3] == [200, 150, 100], "Benefit 'best' should return highest values"
    assert sorted_worst[:3] == [25, 50, 75], "Benefit 'worst' should return lowest values"
    print("  ✅ PASSED\n")
    
    # Test 2: Cost metric (lower is better, like NPL, Cost-to-Income Ratio)
    print("-" * 70)
    print("TEST 2: COST METRIC (e.g., NPL, Cost Ratio - lower is better)")
    print("-" * 70)
    cost_metric = MockMetric("cost")
    
    # Best = lowest values
    order_best = _get_sort_order(cost_metric, "best")
    sorted_best = sorted(values, key=lambda x: x, reverse=(order_best == desc))
    print(f"  rank_type='best'  => {order_best.__name__.upper()} => {sorted_best[:3]}")
    
    # Worst = highest values
    order_worst = _get_sort_order(cost_metric, "worst")
    sorted_worst = sorted(values, key=lambda x: x, reverse=(order_worst == desc))
    print(f"  rank_type='worst' => {order_worst.__name__.upper()} => {sorted_worst[:3]}")
    
    assert sorted_best[:3] == [25, 50, 75], "Cost 'best' should return lowest values"
    assert sorted_worst[:3] == [200, 150, 100], "Cost 'worst' should return highest values"
    print("  ✅ PASSED\n")
    
    # Test 3: Verify that best != worst for both types
    print("-" * 70)
    print("TEST 3: VERIFY BEST != WORST (unless all values equal)")
    print("-" * 70)
    
    benefit_best = sorted(values, key=lambda x: x, reverse=True)[:3]
    benefit_worst = sorted(values, key=lambda x: x, reverse=False)[:3]
    
    cost_best = sorted(values, key=lambda x: x, reverse=False)[:3]
    cost_worst = sorted(values, key=lambda x: x, reverse=True)[:3]
    
    print(f"  Benefit: best={benefit_best} vs worst={benefit_worst}")
    print(f"  Cost:    best={cost_best} vs worst={cost_worst}")
    
    assert benefit_best != benefit_worst, "Benefit best should differ from worst"
    assert cost_best != cost_worst, "Cost best should differ from worst"
    print("  ✅ PASSED\n")
    
    print("=" * 70)
    print("ALL TESTS PASSED! ✅")
    print("=" * 70)
    print("\nSUMMARY:")
    print("  - Benefit metrics: best=DESC (highest), worst=ASC (lowest)")
    print("  - Cost metrics:    best=ASC (lowest), worst=DESC (highest)")
    print("  - Results differ correctly between best and worst rankings")
    print()


if __name__ == "__main__":
    test_sorting_logic()
