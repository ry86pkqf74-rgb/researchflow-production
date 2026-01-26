"""
Outcome Timeline Visualization
Phase 1.2: Generate time-series visualizations of surgical outcomes

Integrates with Stage 08 (Visualization) of the workflow engine.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class FigureMetadata:
    """Metadata for generated figures (for manifest)."""
    path: str
    title: str
    description: str
    alt_text: str
    dimensions: Tuple[int, int]
    data_hash: str
    generated_at: str
    figure_type: str


def _compute_data_hash(df: pd.DataFrame, columns: List[str]) -> str:
    """Compute a hash of the data for provenance."""
    import hashlib
    content = df[columns].to_json()
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def generate_outcome_timeline(
    df: pd.DataFrame,
    date_column: str,
    outcome_column: str,
    output_path: Path,
    aggregation: str = 'month',
    title: Optional[str] = None,
    figsize: Tuple[int, int] = (12, 6)
) -> FigureMetadata:
    """
    Generate time-series visualization of surgical outcomes.
    
    Args:
        df: DataFrame with surgical data
        date_column: Column containing dates
        outcome_column: Column containing outcome values
        output_path: Directory to save the figure
        aggregation: 'week', 'month', or 'quarter'
        title: Optional custom title
        figsize: Figure dimensions in inches
    
    Returns:
        FigureMetadata with figure path and summary
    """
    logger.info(f"Generating outcome timeline for {outcome_column} by {date_column}")
    
    # Ensure output directory exists
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Copy and preprocess
    plot_df = df[[date_column, outcome_column]].copy()
    plot_df[date_column] = pd.to_datetime(plot_df[date_column], errors='coerce')
    plot_df = plot_df.dropna(subset=[date_column])
    
    if len(plot_df) == 0:
        logger.warning("No valid dates found for timeline")
        raise ValueError(f"No valid dates in column {date_column}")
    
    # Aggregate by period
    if aggregation == 'week':
        plot_df['period'] = plot_df[date_column].dt.to_period('W')
        freq_label = 'Weekly'
    elif aggregation == 'quarter':
        plot_df['period'] = plot_df[date_column].dt.to_period('Q')
        freq_label = 'Quarterly'
    else:
        plot_df['period'] = plot_df[date_column].dt.to_period('M')
        freq_label = 'Monthly'
    
    # Count outcomes by period
    counts = plot_df.groupby(['period', outcome_column]).size().unstack(fill_value=0)
    
    # Generate figure
    fig, ax = plt.subplots(figsize=figsize)
    
    # Convert period index to timestamps for plotting
    x_labels = [str(p) for p in counts.index]
    x_pos = range(len(x_labels))
    
    # Stacked bar chart
    bottom = np.zeros(len(counts))
    colors = plt.cm.Set2(np.linspace(0, 1, len(counts.columns)))
    
    for idx, (col, color) in enumerate(zip(counts.columns, colors)):
        ax.bar(x_pos, counts[col], bottom=bottom, label=str(col), color=color)
        bottom += counts[col].values
    
    ax.set_xlabel('Time Period')
    ax.set_ylabel('Count')
    ax.set_title(title or f'{freq_label} Surgical Outcomes Over Time')
    ax.set_xticks(x_pos)
    ax.set_xticklabels(x_labels, rotation=45, ha='right')
    ax.legend(title=outcome_column, loc='upper right')
    
    plt.tight_layout()
    
    # Save figure
    fig_filename = f'outcome_timeline_{aggregation}.png'
    fig_path = output_path / fig_filename
    fig.savefig(fig_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    logger.info(f"Saved outcome timeline to {fig_path}")
    
    # Generate alt text for accessibility
    alt_text = (
        f"Stacked bar chart showing {freq_label.lower()} distribution of {outcome_column} "
        f"from {plot_df[date_column].min().strftime('%Y-%m-%d')} to "
        f"{plot_df[date_column].max().strftime('%Y-%m-%d')}. "
        f"Total cases: {len(df)}. Periods shown: {len(counts)}."
    )
    
    return FigureMetadata(
        path=str(fig_path),
        title=title or f'{freq_label} Surgical Outcomes',
        description=f"Time series of {outcome_column} aggregated by {aggregation}",
        alt_text=alt_text,
        dimensions=(int(figsize[0] * 150), int(figsize[1] * 150)),
        data_hash=_compute_data_hash(df, [date_column, outcome_column]),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        figure_type='outcome_timeline'
    )


def generate_clavien_chart(
    df: pd.DataFrame,
    clavien_column: str,
    output_path: Path,
    title: Optional[str] = None,
    figsize: Tuple[int, int] = (10, 6)
) -> FigureMetadata:
    """
    Generate Clavien-Dindo complication grade distribution chart.
    
    Args:
        df: DataFrame with surgical data
        clavien_column: Column containing Clavien-Dindo grades
        output_path: Directory to save the figure
        title: Optional custom title
        figsize: Figure dimensions
    
    Returns:
        FigureMetadata with figure path and summary
    """
    logger.info(f"Generating Clavien-Dindo chart for {clavien_column}")
    
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Standard Clavien-Dindo grades
    grade_order = ['0', 'I', 'II', 'IIIa', 'IIIb', 'IVa', 'IVb', 'V']
    
    # Count by grade
    counts = df[clavien_column].value_counts()
    
    # Reindex to standard order (missing grades = 0)
    counts = counts.reindex(grade_order, fill_value=0)
    
    # Color scheme: green (0-I) -> yellow (II-III) -> red (IV-V)
    colors = ['#28a745', '#28a745', '#ffc107', '#fd7e14', '#fd7e14', '#dc3545', '#dc3545', '#6c757d']
    
    fig, ax = plt.subplots(figsize=figsize)
    bars = ax.bar(counts.index, counts.values, color=colors[:len(counts)])
    
    # Add value labels on bars
    for bar, val in zip(bars, counts.values):
        if val > 0:
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                   str(val), ha='center', va='bottom', fontsize=10)
    
    ax.set_xlabel('Clavien-Dindo Grade')
    ax.set_ylabel('Number of Patients')
    ax.set_title(title or 'Clavien-Dindo Complication Grade Distribution')
    
    plt.tight_layout()
    
    fig_path = output_path / 'clavien_dindo_distribution.png'
    fig.savefig(fig_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    total = counts.sum()
    major_complications = counts[['IIIa', 'IIIb', 'IVa', 'IVb', 'V']].sum()
    
    alt_text = (
        f"Bar chart showing Clavien-Dindo complication grades. "
        f"Total patients: {total}. Major complications (Grade III+): {major_complications} "
        f"({100*major_complications/total:.1f}% if total > 0 else 0)."
    )
    
    return FigureMetadata(
        path=str(fig_path),
        title=title or 'Clavien-Dindo Distribution',
        description="Distribution of surgical complication grades",
        alt_text=alt_text,
        dimensions=(int(figsize[0] * 150), int(figsize[1] * 150)),
        data_hash=_compute_data_hash(df, [clavien_column]),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        figure_type='clavien_dindo'
    )


def generate_complication_heatmap(
    df: pd.DataFrame,
    procedure_column: str,
    complication_column: str,
    output_path: Path,
    top_n: int = 10,
    title: Optional[str] = None,
    figsize: Tuple[int, int] = (12, 8)
) -> FigureMetadata:
    """
    Generate heatmap of complications by procedure type.
    
    Args:
        df: DataFrame with surgical data
        procedure_column: Column containing procedure types
        complication_column: Column containing complication types
        output_path: Directory to save the figure
        top_n: Number of top procedures to show
        title: Optional custom title
        figsize: Figure dimensions
    
    Returns:
        FigureMetadata with figure path and summary
    """
    logger.info(f"Generating complication heatmap for {procedure_column} x {complication_column}")
    
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Get top N procedures
    top_procedures = df[procedure_column].value_counts().head(top_n).index.tolist()
    subset = df[df[procedure_column].isin(top_procedures)]
    
    # Create cross-tabulation
    cross_tab = pd.crosstab(subset[procedure_column], subset[complication_column])
    
    # Reorder rows by total complications
    row_order = cross_tab.sum(axis=1).sort_values(ascending=False).index
    cross_tab = cross_tab.loc[row_order]
    
    fig, ax = plt.subplots(figsize=figsize)
    im = ax.imshow(cross_tab.values, cmap='YlOrRd', aspect='auto')
    
    # Add colorbar
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Count')
    
    # Set ticks
    ax.set_xticks(range(len(cross_tab.columns)))
    ax.set_yticks(range(len(cross_tab.index)))
    ax.set_xticklabels(cross_tab.columns, rotation=45, ha='right')
    ax.set_yticklabels(cross_tab.index)
    
    ax.set_xlabel('Complication Type')
    ax.set_ylabel('Procedure')
    ax.set_title(title or f'Complications by Procedure (Top {top_n})')
    
    # Add value annotations
    for i in range(len(cross_tab.index)):
        for j in range(len(cross_tab.columns)):
            val = cross_tab.iloc[i, j]
            if val > 0:
                ax.text(j, i, str(val), ha='center', va='center',
                       color='white' if val > cross_tab.values.max()/2 else 'black',
                       fontsize=8)
    
    plt.tight_layout()
    
    fig_path = output_path / 'complication_heatmap.png'
    fig.savefig(fig_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    alt_text = (
        f"Heatmap showing complication rates by procedure type. "
        f"Rows: top {len(cross_tab)} procedures. "
        f"Columns: {len(cross_tab.columns)} complication types."
    )
    
    return FigureMetadata(
        path=str(fig_path),
        title=title or 'Complication Heatmap',
        description="Heatmap of complications by procedure type",
        alt_text=alt_text,
        dimensions=(int(figsize[0] * 150), int(figsize[1] * 150)),
        data_hash=_compute_data_hash(df, [procedure_column, complication_column]),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        figure_type='complication_heatmap'
    )
