"""
Central figure styling for reproducible, publication-ready figures.

This module provides consistent styling across all figures:
- Color palettes (colorblind-safe)
- Font sizes and families
- Line widths and markers
- DPI and figure sizes
- Matplotlib rcParams presets

Usage:
    import matplotlib.pyplot as plt
    from src.figures.style import set_publication_style, get_color_palette

    set_publication_style()
    colors = get_color_palette()

    fig, ax = plt.subplots()
    ax.plot(x, y, color=colors['primary'])
"""

import matplotlib.pyplot as plt
import matplotlib as mpl
from typing import Dict, Optional, Literal

# Color palettes (colorblind-safe)
COLOR_PALETTES = {
    "primary": {
        "primary": "#0173B2",  # Blue
        "secondary": "#DE8F05",  # Orange
        "tertiary": "#029E73",  # Green
        "quaternary": "#CC78BC",  # Purple
        "error": "#CA9161",  # Brown
        "neutral": "#949494",  # Gray
    },
    "okabe_ito": {
        # Colorblind-safe palette from Okabe & Ito (2008)
        "orange": "#E69F00",
        "sky_blue": "#56B4E9",
        "bluish_green": "#009E73",
        "yellow": "#F0E442",
        "blue": "#0072B2",
        "vermillion": "#D55E00",
        "reddish_purple": "#CC79A7",
        "black": "#000000",
    },
    "tableau": {
        # Tableau 10 colorblind-safe palette
        "blue": "#1F77B4",
        "orange": "#FF7F0E",
        "green": "#2CA02C",
        "red": "#D62728",
        "purple": "#9467BD",
        "brown": "#8C564B",
        "pink": "#E377C2",
        "gray": "#7F7F7F",
        "olive": "#BCBD22",
        "cyan": "#17BECF",
    },
}

# Journal-specific styling presets
JOURNAL_PRESETS = {
    "default": {
        "font_size": 10,
        "font_family": "sans-serif",
        "font_sans_serif": ["Arial", "Helvetica", "DejaVu Sans"],
        "figure_width": 7.0,  # inches (two-column width)
        "figure_height": 5.0,  # inches
        "dpi": 300,
        "line_width": 1.5,
        "marker_size": 6,
    },
    "nature": {
        "font_size": 8,
        "font_family": "sans-serif",
        "font_sans_serif": ["Helvetica", "Arial"],
        "figure_width": 6.69,  # inches (full page width)
        "figure_height": 4.5,
        "dpi": 300,
        "line_width": 1.0,
        "marker_size": 4,
    },
    "nejm": {
        "font_size": 9,
        "font_family": "serif",
        "font_serif": ["Times New Roman", "Times"],
        "figure_width": 7.0,
        "figure_height": 5.0,
        "dpi": 600,  # NEJM requires 600 DPI
        "line_width": 1.5,
        "marker_size": 5,
    },
    "jama": {
        "font_size": 9,
        "font_family": "sans-serif",
        "font_sans_serif": ["Arial", "Helvetica"],
        "figure_width": 6.5,
        "figure_height": 4.5,
        "dpi": 300,
        "line_width": 1.2,
        "marker_size": 5,
    },
}


def set_publication_style(
    preset: Literal["default", "nature", "nejm", "jama"] = "default",
    palette: Literal["primary", "okabe_ito", "tableau"] = "primary",
    context: Literal["paper", "notebook", "talk", "poster"] = "paper",
) -> None:
    """
    Set matplotlib rcParams for publication-ready figures.

    Args:
        preset: Journal-specific styling preset
        palette: Color palette to use
        context: Context for scaling (paper, notebook, talk, poster)

    Examples:
        # Default publication style
        set_publication_style()

        # Nature journal style
        set_publication_style(preset="nature")

        # NEJM journal style with Okabe-Ito colors
        set_publication_style(preset="nejm", palette="okabe_ito")
    """
    # Get preset settings
    settings = JOURNAL_PRESETS[preset]

    # Context scaling
    scale_factors = {
        "paper": 1.0,
        "notebook": 1.2,
        "talk": 1.5,
        "poster": 2.0,
    }
    scale = scale_factors[context]

    # Apply rcParams
    plt.rcParams.update(
        {
            # Font settings
            "font.size": settings["font_size"] * scale,
            "font.family": settings["font_family"],
            "axes.labelsize": settings["font_size"] * scale,
            "axes.titlesize": settings["font_size"] * scale * 1.2,
            "xtick.labelsize": settings["font_size"] * scale * 0.9,
            "ytick.labelsize": settings["font_size"] * scale * 0.9,
            "legend.fontsize": settings["font_size"] * scale * 0.9,
            # Figure settings
            "figure.dpi": settings["dpi"],
            "savefig.dpi": settings["dpi"],
            "figure.figsize": (settings["figure_width"], settings["figure_height"]),
            # Line and marker settings
            "lines.linewidth": settings["line_width"] * scale,
            "lines.markersize": settings["marker_size"] * scale,
            "patch.linewidth": settings["line_width"] * scale,
            # Axes settings
            "axes.linewidth": 0.8 * scale,
            "axes.edgecolor": "#000000",
            "axes.facecolor": "#FFFFFF",
            "axes.grid": False,
            "axes.axisbelow": True,
            "axes.spines.top": False,
            "axes.spines.right": False,
            # Grid settings
            "grid.color": "#DDDDDD",
            "grid.linestyle": "-",
            "grid.linewidth": 0.5 * scale,
            # Legend settings
            "legend.frameon": False,
            "legend.numpoints": 1,
            "legend.scatterpoints": 1,
            # Tick settings
            "xtick.direction": "out",
            "ytick.direction": "out",
            "xtick.major.size": 4 * scale,
            "ytick.major.size": 4 * scale,
            "xtick.minor.size": 2 * scale,
            "ytick.minor.size": 2 * scale,
            # PDF/SVG settings
            "pdf.fonttype": 42,  # TrueType fonts
            "ps.fonttype": 42,
            "svg.fonttype": "none",
            # Other
            "image.cmap": "viridis",
            "image.interpolation": "nearest",
        }
    )

    # Set font-specific settings
    if "font_sans_serif" in settings:
        plt.rcParams["font.sans-serif"] = settings["font_sans_serif"]
    if "font_serif" in settings:
        plt.rcParams["font.serif"] = settings["font_serif"]

    # Set color cycle
    colors = get_color_palette(palette)
    color_list = list(colors.values())
    plt.rcParams["axes.prop_cycle"] = mpl.cycler(color=color_list)


def get_color_palette(
    palette: Literal["primary", "okabe_ito", "tableau"] = "primary"
) -> Dict[str, str]:
    """
    Get a colorblind-safe color palette.

    Args:
        palette: Palette name

    Returns:
        Dictionary mapping color names to hex codes

    Examples:
        colors = get_color_palette("okabe_ito")
        plt.plot(x, y, color=colors["blue"])
    """
    return COLOR_PALETTES[palette].copy()


def reset_style() -> None:
    """
    Reset matplotlib style to defaults.

    Examples:
        set_publication_style()
        # ... generate figures ...
        reset_style()  # Clean up
    """
    mpl.rcParams.update(mpl.rcParamsDefault)


def get_figure_size(
    preset: Literal["default", "nature", "nejm", "jama"] = "default",
    width_fraction: float = 1.0,
    aspect_ratio: Optional[float] = None,
) -> tuple[float, float]:
    """
    Calculate figure size for a given preset.

    Args:
        preset: Journal preset
        width_fraction: Fraction of full width (e.g., 0.5 for half-width)
        aspect_ratio: Height/width ratio (overrides preset height)

    Returns:
        (width, height) in inches

    Examples:
        # Full-width figure
        fig, ax = plt.subplots(figsize=get_figure_size("nature"))

        # Half-width with golden ratio
        fig, ax = plt.subplots(figsize=get_figure_size("nature", 0.5, 0.618))
    """
    settings = JOURNAL_PRESETS[preset]
    width = settings["figure_width"] * width_fraction

    if aspect_ratio is not None:
        height = width * aspect_ratio
    else:
        height = settings["figure_height"]

    return (width, height)


# Useful constants
GOLDEN_RATIO = 1.618
PHI = GOLDEN_RATIO
SQRT2 = 1.414
