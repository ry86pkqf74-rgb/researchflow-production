from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer

from ros_irb.generate_irb_request import IRBRequestInput, assemble_irb_draft, render_irb_markdown
from ros_irb.phi_guard import redact_phi
from ros_irb.export import export_docx as export_docx_func, export_pdf as export_pdf_func


app = typer.Typer(help="IRB utilities (draft generation, export).")


def _load_config(path: Path) -> dict:
    if not path.exists():
        raise typer.BadParameter(f"Config file not found: {path}")
    if path.suffix.lower() in {".json"}:
        return json.loads(path.read_text(encoding="utf-8"))

    if path.suffix.lower() in {".yml", ".yaml"}:
        try:
            import yaml  # type: ignore
        except Exception as e:
            raise typer.BadParameter(
                "YAML config requested but PyYAML is not installed. Use JSON or install PyYAML."
            ) from e
        return yaml.safe_load(path.read_text(encoding="utf-8"))

    raise typer.BadParameter("Config must be .json, .yml, or .yaml")


@app.command()
def generate(
    config: Optional[Path] = typer.Option(None, "--config", "-c", help="Path to YAML/JSON config."),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Write markdown to this path."),
    redact: bool = typer.Option(True, "--redact/--no-redact", help="Redact PHI/PII patterns in output."),
    export_pdf: Optional[Path] = typer.Option(None, "--export-pdf", help="Export draft to PDF file."),
    export_docx: Optional[Path] = typer.Option(None, "--export-docx", help="Export draft to DOCX file."),
):
    """
    Generate an IRB markdown draft from a config file or interactive prompts.

    JSON/YAML schema:
      {
        "study_title": "...",
        "research_question": "...",
        "literature_query": "...",
        "answers": { "purpose_significance": "...", ... }
      }
    """
    if config is None:
        study_title = typer.prompt("Study title", default="Untitled Study")
        research_question = typer.prompt("Research question (optional)", default="")
        user_input = IRBRequestInput(study_title=study_title, research_question=research_question, answers={})
    else:
        cfg = _load_config(config)
        user_input = IRBRequestInput(
            study_title=cfg.get("study_title", "Untitled Study"),
            research_question=cfg.get("research_question", ""),
            answers=cfg.get("answers", {}) or {},
            literature_query=cfg.get("literature_query"),
        )

    draft = assemble_irb_draft(user_input, searcher=None, llm=None, apply_phi_guard=redact)
    md = render_irb_markdown(draft)
    md = redact_phi(md) if redact else md

    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(md, encoding="utf-8")
        typer.echo(str(output))
    else:
        typer.echo(md)

    # Export to additional formats if requested
    if export_pdf:
        try:
            pdf_path = export_pdf_func(draft, export_pdf, redact=redact)
            typer.echo(f"PDF exported to: {pdf_path}")
        except ImportError:
            typer.echo("Error: reportlab required for PDF export. Install with: pip install -e \".[irb]\"", err=True)
            raise typer.Exit(code=1)

    if export_docx:
        try:
            docx_path = export_docx_func(draft, export_docx, redact=redact)
            typer.echo(f"DOCX exported to: {docx_path}")
        except ImportError:
            typer.echo("Error: python-docx required for DOCX export. Install with: pip install -e \".[irb]\"", err=True)
            raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
