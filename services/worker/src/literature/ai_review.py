"""
AI Literature Review Service

Provides AI-powered literature analysis:
- Automatic summarization
- Key findings extraction
- Methodology analysis
- Research gap identification
- Citation network analysis
- Theme clustering
"""

import asyncio
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import os


@dataclass
class Paper:
    """Represents a research paper"""
    id: str
    title: str
    abstract: str
    authors: List[str]
    year: int
    journal: Optional[str] = None
    doi: Optional[str] = None
    citations: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    full_text: Optional[str] = None


@dataclass
class ReviewSection:
    """Section of a literature review"""
    title: str
    content: str
    papers: List[str]  # Paper IDs
    subsections: List['ReviewSection'] = field(default_factory=list)


@dataclass
class LiteratureReview:
    """Complete literature review output"""
    title: str
    query: str
    generated_at: str
    summary: str
    sections: List[ReviewSection]
    key_findings: List[str]
    research_gaps: List[str]
    future_directions: List[str]
    methodology_analysis: Dict[str, Any]
    paper_count: int
    themes: List[Dict[str, Any]]


class AILiteratureReviewer:
    """AI-powered literature review generator"""

    def __init__(self, llm_client=None):
        """
        Initialize reviewer with LLM client.

        Args:
            llm_client: OpenAI-compatible client for AI generation
        """
        self.llm_client = llm_client
        self.model = os.getenv('LLM_MODEL', 'gpt-4-turbo-preview')

    async def generate_review(
        self,
        papers: List[Paper],
        query: str,
        max_papers: int = 50,
        include_full_text: bool = False
    ) -> LiteratureReview:
        """
        Generate a comprehensive literature review.

        Args:
            papers: List of papers to review
            query: Research question or topic
            max_papers: Maximum papers to include
            include_full_text: Whether to use full text analysis

        Returns:
            Complete LiteratureReview object
        """
        # Limit papers
        papers = papers[:max_papers]

        # Run analysis tasks in parallel
        summary_task = self._generate_summary(papers, query)
        themes_task = self._identify_themes(papers)
        gaps_task = self._identify_gaps(papers, query)
        methods_task = self._analyze_methodologies(papers)

        summary, themes, gaps, methods = await asyncio.gather(
            summary_task, themes_task, gaps_task, methods_task
        )

        # Generate sections based on themes
        sections = await self._generate_sections(papers, themes, query)

        # Extract key findings
        key_findings = await self._extract_key_findings(papers)

        # Generate future directions
        future_directions = await self._suggest_future_directions(papers, gaps)

        return LiteratureReview(
            title=f"Literature Review: {query}",
            query=query,
            generated_at=datetime.utcnow().isoformat(),
            summary=summary,
            sections=sections,
            key_findings=key_findings,
            research_gaps=gaps,
            future_directions=future_directions,
            methodology_analysis=methods,
            paper_count=len(papers),
            themes=themes
        )

    async def _generate_summary(self, papers: List[Paper], query: str) -> str:
        """Generate executive summary of the literature"""
        paper_summaries = "\n".join([
            f"- {p.title} ({p.year}): {p.abstract[:200]}..."
            for p in papers[:20]
        ])

        prompt = f"""Generate a comprehensive executive summary for a literature review on: "{query}"

Based on {len(papers)} papers including:
{paper_summaries}

The summary should:
1. Introduce the research topic and its significance
2. Highlight the main findings across the literature
3. Note areas of consensus and controversy
4. Be approximately 300-400 words

Write the summary:"""

        return await self._call_llm(prompt)

    async def _identify_themes(self, papers: List[Paper]) -> List[Dict[str, Any]]:
        """Identify major themes across papers"""
        # Collect all abstracts and keywords
        abstracts = [p.abstract for p in papers]
        all_keywords = []
        for p in papers:
            all_keywords.extend(p.keywords)

        prompt = f"""Analyze these {len(papers)} paper abstracts and identify the major themes:

Sample abstracts:
{chr(10).join(abstracts[:10])}

Common keywords: {', '.join(set(all_keywords)[:30])}

Identify 4-6 major themes. For each theme provide:
1. Theme name
2. Brief description (2-3 sentences)
3. Estimated number of papers addressing this theme
4. Key terms associated with this theme

Return as JSON array:
[{{"name": "theme", "description": "...", "paper_count": N, "key_terms": ["term1", "term2"]}}]"""

        response = await self._call_llm(prompt)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return [{"name": "General", "description": "Main theme", "paper_count": len(papers), "key_terms": []}]

    async def _identify_gaps(self, papers: List[Paper], query: str) -> List[str]:
        """Identify research gaps in the literature"""
        recent_papers = sorted(papers, key=lambda p: p.year, reverse=True)[:10]

        prompt = f"""Based on these recent papers on "{query}":

{chr(10).join([f'- {p.title} ({p.year})' for p in recent_papers])}

Identify 5-7 research gaps or under-explored areas. These should be:
1. Specific and actionable research opportunities
2. Based on limitations mentioned in existing work
3. Addressing methodological or conceptual gaps

List the gaps:"""

        response = await self._call_llm(prompt)
        return [line.strip('- ').strip() for line in response.split('\n') if line.strip()]

    async def _analyze_methodologies(self, papers: List[Paper]) -> Dict[str, Any]:
        """Analyze methodologies used across papers"""
        abstracts = [p.abstract for p in papers[:30]]

        prompt = f"""Analyze the research methodologies in these paper abstracts:

{chr(10).join(abstracts[:15])}

Provide analysis as JSON:
{{
  "study_designs": {{"type1": count, "type2": count}},
  "sample_sizes": {{"small": count, "medium": count, "large": count}},
  "data_types": ["type1", "type2"],
  "analysis_methods": ["method1", "method2"],
  "limitations_noted": ["limitation1", "limitation2"],
  "quality_assessment": "overall assessment of methodological rigor"
}}"""

        response = await self._call_llm(prompt)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"study_designs": {}, "quality_assessment": "Unable to analyze"}

    async def _generate_sections(
        self,
        papers: List[Paper],
        themes: List[Dict[str, Any]],
        query: str
    ) -> List[ReviewSection]:
        """Generate review sections based on themes"""
        sections = []

        for theme in themes[:5]:
            # Find papers matching this theme
            theme_papers = self._match_papers_to_theme(papers, theme)

            prompt = f"""Write a literature review section on "{theme['name']}" for a review about "{query}".

Relevant papers:
{chr(10).join([f'- {p.title} ({p.year}): {p.abstract[:150]}...' for p in theme_papers[:8]])}

The section should:
1. Synthesize findings across papers (don't just summarize each paper)
2. Note agreements and disagreements
3. Be 200-300 words
4. Use academic writing style

Write the section:"""

            content = await self._call_llm(prompt)

            sections.append(ReviewSection(
                title=theme['name'],
                content=content,
                papers=[p.id for p in theme_papers]
            ))

        return sections

    async def _extract_key_findings(self, papers: List[Paper]) -> List[str]:
        """Extract key findings across the literature"""
        prompt = f"""Based on these {len(papers)} paper abstracts, extract 8-10 key findings:

{chr(10).join([f'{p.abstract[:200]}...' for p in papers[:15]])}

List the most important, well-supported findings. Each finding should be:
1. Specific and evidence-based
2. Clearly stated in one sentence
3. Representative of multiple papers

Key findings:"""

        response = await self._call_llm(prompt)
        return [line.strip('- ').strip() for line in response.split('\n') if line.strip()][:10]

    async def _suggest_future_directions(
        self,
        papers: List[Paper],
        gaps: List[str]
    ) -> List[str]:
        """Suggest future research directions"""
        prompt = f"""Given these research gaps:
{chr(10).join([f'- {g}' for g in gaps])}

And recent work in the field including:
{chr(10).join([f'- {p.title}' for p in papers[:10]])}

Suggest 5-7 promising future research directions. Each should be:
1. Specific enough to guide new research
2. Feasible with current methods/technology
3. Likely to advance the field significantly

Future directions:"""

        response = await self._call_llm(prompt)
        return [line.strip('- ').strip() for line in response.split('\n') if line.strip()][:7]

    def _match_papers_to_theme(
        self,
        papers: List[Paper],
        theme: Dict[str, Any]
    ) -> List[Paper]:
        """Find papers matching a theme based on keywords and terms"""
        key_terms = set(term.lower() for term in theme.get('key_terms', []))
        theme_name = theme['name'].lower()

        scored_papers = []
        for paper in papers:
            score = 0
            text = (paper.title + ' ' + paper.abstract).lower()

            # Check for theme name
            if theme_name in text:
                score += 3

            # Check for key terms
            for term in key_terms:
                if term in text:
                    score += 1

            if score > 0:
                scored_papers.append((score, paper))

        # Sort by score and return top papers
        scored_papers.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored_papers[:15]]

    async def _call_llm(self, prompt: str) -> str:
        """Call LLM for generation"""
        if self.llm_client:
            try:
                response = await self.llm_client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1500,
                    temperature=0.7
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"LLM call failed: {e}")

        # Fallback response
        return "AI generation unavailable. Please configure LLM client."

    def export_to_markdown(self, review: LiteratureReview) -> str:
        """Export literature review to Markdown format"""
        lines = [
            f"# {review.title}",
            "",
            f"*Generated: {review.generated_at}*",
            f"*Papers analyzed: {review.paper_count}*",
            "",
            "## Executive Summary",
            "",
            review.summary,
            "",
            "## Key Findings",
            "",
        ]

        for finding in review.key_findings:
            lines.append(f"- {finding}")

        lines.extend(["", "## Thematic Analysis", ""])

        for section in review.sections:
            lines.extend([
                f"### {section.title}",
                "",
                section.content,
                ""
            ])

        lines.extend(["## Research Gaps", ""])
        for gap in review.research_gaps:
            lines.append(f"- {gap}")

        lines.extend(["", "## Future Directions", ""])
        for direction in review.future_directions:
            lines.append(f"- {direction}")

        lines.extend(["", "## Methodology Analysis", ""])
        lines.append(f"```json\n{json.dumps(review.methodology_analysis, indent=2)}\n```")

        return "\n".join(lines)


# Convenience function
async def generate_literature_review(
    papers: List[Paper],
    query: str,
    llm_client=None
) -> LiteratureReview:
    """Generate a literature review from papers"""
    reviewer = AILiteratureReviewer(llm_client)
    return await reviewer.generate_review(papers, query)
