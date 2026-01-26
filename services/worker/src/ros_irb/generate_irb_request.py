"""
IRB request assembly and optional AI-assisted generation.

Core design goals:
- Deterministic assembly of an IRB draft from user-provided answers.
- Optional auto-generation helpers via dependency-injected providers.
- Always run PHI guard on generated output (and optionally on user input).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Protocol, Sequence

from ros_irb.irb_questions import IRBQuestion, IRB_QUESTIONS
from ros_irb.phi_guard import redact_phi


class LiteratureSearcher(Protocol):
    def search(self, query: str, k: int = 5) -> List[Dict[str, str]]:
        """Return list of dicts with at least: title, abstract(optional), url(optional)."""


class LLMProvider(Protocol):
    def complete(self, prompt: str) -> str:
        """Return a completion for the prompt."""


@dataclass
class IRBRequestInput:
    study_title: str = "Untitled Study"
    research_question: str = ""
    answers: Dict[str, str] = field(default_factory=dict)
    literature_query: Optional[str] = None


@dataclass
class IRBDraft:
    study_title: str
    created_at_iso: str
    answers: Dict[str, str]
    literature_summary: Optional[str] = None
    literature_refs: List[Dict[str, str]] = field(default_factory=list)


def summarize_literature(
    query: str,
    searcher: LiteratureSearcher,
    llm: Optional[LLMProvider] = None,
    k: int = 5,
) -> tuple[str, List[Dict[str, str]]]:
    hits = searcher.search(query, k=k)
    corpus_lines: List[str] = []
    for h in hits:
        title = h.get("title", "").strip()
        abstract = h.get("abstract", "").strip()
        url = h.get("url", "").strip()
        line = f"- {title}"
        if url:
            line += f" ({url})"
        if abstract:
            line += f": {abstract}"
        corpus_lines.append(line)
    corpus = "\n".join(corpus_lines).strip()

    if not corpus:
        return ("No literature results were provided.", hits)

    if llm is None:
        first_lines = corpus_lines[: min(5, len(corpus_lines))]
        summary = "Key related work (top results):\n" + "\n".join(first_lines)
        return (summary, hits)

    prompt = (
        "Summarize the following literature search results for use in an IRB application. "
        "Keep it non-technical and focus on why the study is important and what is already known.\n\n"
        f"{corpus}\n"
    )
    return (llm.complete(prompt).strip(), hits)


def auto_generate_answers(
    questions: Sequence[IRBQuestion],
    user_input: IRBRequestInput,
    literature_summary: Optional[str],
    llm: LLMProvider,
) -> Dict[str, str]:
    out: Dict[str, str] = dict(user_input.answers)
    for q in questions:
        existing = (out.get(q.category) or "").strip()
        if existing:
            continue

        prompt = (
            "You are helping draft an IRB application. "
            "Write a concise, non-technical response.\n\n"
            f"Section: {q.title}\n"
            f"Prompt: {q.prompt}\n"
        )
        if q.guidance:
            prompt += "Guidance:\n" + "\n".join(f"- {g}" for g in q.guidance) + "\n"
        if user_input.research_question.strip():
            prompt += f"\nResearch question:\n{user_input.research_question.strip()}\n"
        if literature_summary:
            prompt += f"\nRelevant literature summary:\n{literature_summary}\n"
        prompt += "\nResponse:\n"

        out[q.category] = llm.complete(prompt).strip()
    return out


def assemble_irb_draft(
    user_input: IRBRequestInput,
    questions: Sequence[IRBQuestion] = IRB_QUESTIONS,
    *,
    searcher: Optional[LiteratureSearcher] = None,
    llm: Optional[LLMProvider] = None,
    apply_phi_guard: bool = True,
) -> IRBDraft:
    literature_summary: Optional[str] = None
    literature_refs: List[Dict[str, str]] = []

    if user_input.literature_query and searcher is not None:
        literature_summary, literature_refs = summarize_literature(
            query=user_input.literature_query,
            searcher=searcher,
            llm=llm,
        )

    answers = dict(user_input.answers)
    if llm is not None:
        answers = auto_generate_answers(questions, user_input, literature_summary, llm)

    if apply_phi_guard:
        literature_summary = redact_phi(literature_summary or "") if literature_summary else None
        answers = {k: redact_phi(v or "") for k, v in answers.items()}

    created_at = datetime.now(timezone.utc).isoformat()
    return IRBDraft(
        study_title=(user_input.study_title or "Untitled Study"),
        created_at_iso=created_at,
        answers=answers,
        literature_summary=literature_summary,
        literature_refs=literature_refs,
    )


def render_irb_markdown(
    draft: IRBDraft,
    questions: Sequence[IRBQuestion] = IRB_QUESTIONS,
) -> str:
    lines: List[str] = []
    lines.append(f"# IRB Draft: {draft.study_title}".strip())
    lines.append("")
    lines.append(f"_Generated: {draft.created_at_iso}_")
    lines.append("")

    if draft.literature_summary:
        lines.append("## Literature Context (Auto-generated)")
        lines.append("")
        lines.append(draft.literature_summary.strip())
        lines.append("")

    for q in questions:
        lines.append(f"## {q.title}")
        lines.append("")
        lines.append(f"**Prompt:** {q.prompt}")
        lines.append("")
        answer = (draft.answers.get(q.category) or "").strip()
        if not answer:
            answer = "_[No response provided yet]_"
        lines.append(answer)
        lines.append("")

    if draft.literature_refs:
        lines.append("## References (Search Results)")
        lines.append("")
        for h in draft.literature_refs:
            title = (h.get("title") or "Untitled").strip()
            url = (h.get("url") or "").strip()
            if url:
                lines.append(f"- {title} ({url})")
            else:
                lines.append(f"- {title}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"
