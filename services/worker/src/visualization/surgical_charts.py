"""
Surgical Analytics Charts
Phase 1.2: Additional surgical visualization generators

Provides ASA distribution, LOS boxplots, and EBL histograms.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

from .outcome_timeline import FigureMetadata, _compute_data_hash

logger = logging.getLogger(__name__)


def generate_asa_distribution(
    df: pd.DataFrame,
    asa_column: str,
    output_path: Path,
    title: Optional[str] = None,
    figsize: Tuple[int, int] = (10, 6)
) -> FigureMetadata:
    """
    Generate ASA Physical Status Classification distribution chart.
    
    Args:
        df: DataFrame with surgical data
        asa_column: Column containing ASA class (1-6)
        output_path: Directory to save the figure
        title: Optional custom title
        figsize: Figure dimensions
    
    Returns:
        FigureMetadata with figure path and summary
    """
    logger.info(f"Generating ASA distribution chart for {asa_column}")
    
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Standard ASA classes
    asa_order = ['I', 'II', 'III', 'IV', 'V', 'VI']
    asa_labels = {
        'I': 'I - Healthy',
        'II': 'II - Mild systemic',
        'III': 'III - Severe systemic',
        'IV': 'IV - Life-threatening',
        'V': 'V - Moribund',
        'VI': 'VI - Brain-dead donor'
    }
    
    # Normalize ASA values
    def normalize_asa(val):
        if pd.isna(val):
            return None
        val_str = str(val).strip().upper()
        # Handle numeric (1-6) or Roman numeral
        mapping = {'1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'}
        return mapping.get(val_str, val_str if val_str in asa_order else None)
    
    df_plot = df.copy()
    df_plot['asa_normalized'] = df_plot[asa_column].apply(normalize_asa)
    
    counts = df_plot['asa_normalized'].value_counts()
    counts = counts.reindex(asa_order, fill_value=0)
    
    # Color gradient: green to red based on severity
    colors = ['#28a745', '#5cb85c', '#ffc107', '#fd7e14', '#dc3545', '#6c757d']
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=figsize)
    
    # Bar chart
    bars = ax1.bar(counts.index, counts.values, color=colors[:len(counts)])
    ax1.set_xlabel('ASA Physical Status')
    ax1.set_ylabel('Number of Patients')
    ax1.set_title('ASA Distribution')
    
    # Add value labels
    for bar, val in zip(bars, counts.values):
        if val > 0:
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                    str(val), ha='center', va='bottom', fontsize=10)
    
    # Pie chart
    non_zero = counts[counts > 0]
    wedges, texts, autotexts = ax2.pie(
        non_zero.values,
        labels=[asa_labels.get(x, x) for x in non_zero.index],
        colors=[colors[asa_order.index(x)] for x in non_zero.index],
        autopct='%1.1f%%',
        startangle=90
    )
    ax2.set_title('ASA Proportions')
    
    plt.tight_layout()
    
    fig_path = output_path / 'asa_distribution.png'
    fig.savefig(fig_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    total = counts.sum()
    high_risk = counts[['III', 'IV', 'V']].sum()
    
    alt_text = (
        f"ASA Physical Status distribution. Total patients: {total}. "
        f"High-risk (ASA III+): {high_risk} ({100*high_risk/total:.1f}% if total > 0 else 0%)."
    )
    
    return FigureMetadata(
        path=str(fig_path),
        title=title or 'ASA Distribution',
        description="ASA Physical Status Classification distribution",
        alt_text=alt_text,
        dimensions=(int(figsize[0] * 150), int(figsize[1] * 150)),
        data_hash=_compute_data_hash(df, [asa_column]),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        figure_type='asa_distribution'
    )


def generate_los_boxplot(
    df: pd.DataFrame,
    los_column: str,
    group_column: Optional[str] = None,
    output_path: Path = None,
    title: Optional[str] = None,
    figsize: Tuple[int, int] = (12, 6)
) -> FigureMetadata:
    """
    Generate Length of Stay boxplot, optionally grouped by procedure/outcome.
    
    Args:
        df: DataFrame with surgical data
        los_column: Column containing LOS in days
        group_column: Optional column to group by
        output_path: Directory to save the figure
        title: Optional custom title
        figsize: Figure dimensions
    
    Returns:
        FigureMetadata with figure path and summary
    """
    logger.info(f"Generating LOS boxplot for {los_column}")
    
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Convert to numeric
    df_plot = df.copy()
    df_plot[los_column] = pd.to_numeric(df_plot[los_column], errors='coerce')
    df_plot = df_plot.dropna(subset=[los_column])
    
    if group_column and group_column in df_plot.columns:
        # Get top groups for readability
        top_groups = df_plot[group_column].value_counts().head(10).index.tolist()
        df_filtered = df_plot[df_plot[group_column].isin(top_groups)]
        
        # Group data for boxplot
        groups = [df_filtered[df_filtered[group_column] == g][los_column].values 
                  for g in top_groups]
        
        bp = ax.boxplot(groups, labels=top_groups, patch_artist=True)
        for patch in bp['boxes']:
            patch.set_facecolor('#3498db')
            patch.set_alpha(0.7)
        
        ax.set_xticklabels(top_groups, rotation=45, ha='right')
        ax.set_xlabel(group_column)
    else:
        bp = ax.boxplot([df_plot[los_column].values], labels=['All Patients'], patch_artist=True)
        bp['boxes'][0].set_facecolor('#3498db')
        bp['boxes'][0].set_alpha(0.7)
    
    ax.set_ylabel('Length of Stay (days)')
    ax.set_title(title or 'Length of Stay Distribution')
    
    # Add median line label
    median = df_plot[los_column].median()
    ax.axhline(y=median, color='r', linestyle='--', alpha=0.5, label=f'Overall Median: {median:.1f} days')
    ax.legend(loc='upper right')
    
    plt.tight_layout()
    
    fig_path = output_path / 'los_boxplot.png'
    fig.savefig(fig_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    stats = df_plot[los_column].describe()
    alt_text = (
        f"Boxplot of Length of Stay. "
        f"Median: {stats['50%']:.1f} days, Mean: {stats['mean']:.1f} days, "
        f"Range: {stats['min']:.0f}-{stats['max']:.0f} days. N={int(stats['count'])}."
    )
    
    return FigureMetadata(
        path=str(fig_path),
        title=title or 'LOS Boxplot',
        description="Length of Stay distribution boxplot",
        alt_text=alt_text,
        dimensions=(int(figsize[0] * 150), int(figsize[1] * 150)),
        data_hash=_compute_data_hash(df, [los_column]),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        figure_type='los_boxplot'
    )


def generate_ebl_histogram(
    df: pd.DataFrame,
    ebl_column: str,
    output_path: Path,
    bins: int = 20,
    title: Optional[str] = None,
    figsize: Tuple[int, int] = (10, 6)
) -> FigureMetadata:
    """
    Generate Estimated Blood Loss histogram.
    
    Args:
        df: DataFrame with surgical data
        ebl_column: Column containing EBL in mL
        output_path: Directory to save the figure
        bins: Number of histogram bins
        title: Optional custom title
        figsize: Figure dimensions
    
    Returns:
        FigureMetadata with figure path and summary
    """
    logger.info(f"Generating EBL histogram for {ebl_column}")
    
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    df_plot = df.copy()
    df_plot[ebl_column] = pd.to_numeric(df_plot[ebl_column], errors='coerce')
    df_plot = df_plot.dropna(subset=[ebl_column])
    df_plot = df_plot[df_plot[ebl_column] >= 0]  # Remove negative values
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Create histogram with custom bins
    data = df_plot[ebl_column].values
    
    # Add color gradient based on blood loss severity
    n, bins_edges, patches = ax.hist(data, bins=bins, edgecolor='black', alpha=0.7)
    
    # Color code: green (<500), yellow (500-1000), red (>1000)
    for patch, left_edge in zip(patches, bins_edges[:-1]):
        if left_edge < 500:
            patch.set_facecolor('#28a745')
        elif left_edge < 1000:
            patch.set_facecolor('#ffc107')
        else:
            patch.set_facecolor('#dc3545')
    
    ax.set_xlabel('Estimated Blood Loss (mL)')
    ax.set_ylabel('Number of Cases')
    ax.set_title(title or 'Estimated Blood Loss Distribution')
    
    # Add reference lines
    ax.axvline(x=500, color='orange', linestyle='--', alpha=0.7, label='500 mL threshold')
    ax.axvline(x=1000, color='red', linestyle='--', alpha=0.7, label='1000 mL threshold')
    
    # Add statistics
    mean_ebl = data.mean()
    median_ebl = np.median(data)
    ax.axvline(x=median_ebl, color='blue', linestyle='-', alpha=0.5, label=f'Median: {median_ebl:.0f} mL')
    
    ax.legend(loc='upper right')
    
    plt.tight_layout()
    
    fig_path = output_path / 'ebl_histogram.png'
    fig.savefig(fig_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    high_ebl = (data > 1000).sum()
    alt_text = (
        f"Histogram of Estimated Blood Loss. "
        f"Median: {median_ebl:.0f} mL, Mean: {mean_ebl:.0f} mL. "
        f"Cases >1000 mL: {high_ebl} ({100*high_ebl/len(data):.1f}%). N={len(data)}."
    )
    
    return FigureMetadata(
        path=str(fig_path),
        title=title or 'EBL Histogram',
        description="Estimated Blood Loss distribution histogram",
        alt_text=alt_text,
        dimensions=(int(figsize[0] * 150), int(figsize[1] * 150)),
        data_hash=_compute_data_hash(df, [ebl_column]),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        figure_type='ebl_histogram'
    )
