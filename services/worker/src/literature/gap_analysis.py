"""
Literature Gap Analysis Service

Identifies research gaps through:
- Citation network analysis
- Topic coverage mapping
- Temporal trend analysis
- Methodology gap detection
- Geographic/demographic coverage gaps
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict
from datetime import datetime
import re


@dataclass
class Paper:
    """Research paper for gap analysis"""
    id: str
    title: str
    abstract: str
    year: int
    authors: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    citations: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    methodology: Optional[str] = None
    population: Optional[str] = None
    location: Optional[str] = None


@dataclass
class Gap:
    """Identified research gap"""
    type: str  # topic, methodology, population, temporal, geographic
    description: str
    severity: str  # high, medium, low
    evidence: List[str]
    suggested_research: str
    related_papers: List[str]
    confidence: float  # 0-1


@dataclass
class GapAnalysisResult:
    """Complete gap analysis output"""
    query: str
    analyzed_at: str
    paper_count: int
    gaps: List[Gap]
    topic_coverage: Dict[str, int]
    methodology_distribution: Dict[str, int]
    temporal_trends: Dict[int, int]
    recommendations: List[str]
    network_stats: Dict[str, Any]


class GapAnalyzer:
    """Analyzes research literature for gaps"""

    # Common research methodologies to detect
    METHODOLOGIES = [
        'randomized controlled trial', 'rct', 'cohort study', 'case-control',
        'cross-sectional', 'systematic review', 'meta-analysis', 'qualitative',
        'survey', 'retrospective', 'prospective', 'observational',
        'experimental', 'longitudinal', 'case study', 'mixed methods'
    ]

    # Common population groups
    POPULATIONS = [
        'pediatric', 'children', 'adolescent', 'adult', 'elderly', 'geriatric',
        'pregnant', 'male', 'female', 'minority', 'underserved', 'rural'
    ]

    def analyze(
        self,
        papers: List[Paper],
        query: str,
        existing_gaps: Optional[List[str]] = None
    ) -> GapAnalysisResult:
        """
        Perform comprehensive gap analysis.

        Args:
            papers: Papers to analyze
            query: Research query/topic
            existing_gaps: Known gaps to validate

        Returns:
            Complete gap analysis results
        """
        gaps = []

        # Analyze different dimensions
        topic_gaps = self._analyze_topic_gaps(papers, query)
        method_gaps = self._analyze_methodology_gaps(papers)
        temporal_gaps = self._analyze_temporal_gaps(papers)
        population_gaps = self._analyze_population_gaps(papers)
        network_gaps = self._analyze_citation_network(papers)

        gaps.extend(topic_gaps)
        gaps.extend(method_gaps)
        gaps.extend(temporal_gaps)
        gaps.extend(population_gaps)
        gaps.extend(network_gaps)

        # Calculate coverage statistics
        topic_coverage = self._calculate_topic_coverage(papers)
        method_dist = self._calculate_methodology_distribution(papers)
        temporal_trends = self._calculate_temporal_trends(papers)
        network_stats = self._calculate_network_stats(papers)

        # Generate recommendations
        recommendations = self._generate_recommendations(gaps)

        # Sort gaps by severity
        severity_order = {'high': 0, 'medium': 1, 'low': 2}
        gaps.sort(key=lambda g: (severity_order.get(g.severity, 3), -g.confidence))

        return GapAnalysisResult(
            query=query,
            analyzed_at=datetime.utcnow().isoformat(),
            paper_count=len(papers),
            gaps=gaps,
            topic_coverage=topic_coverage,
            methodology_distribution=method_dist,
            temporal_trends=temporal_trends,
            recommendations=recommendations,
            network_stats=network_stats
        )

    def _analyze_topic_gaps(self, papers: List[Paper], query: str) -> List[Gap]:
        """Identify gaps in topic coverage"""
        gaps = []

        # Extract all topics/keywords
        all_keywords = []
        for p in papers:
            all_keywords.extend(p.keywords)
            # Extract potential keywords from title
            words = re.findall(r'\b[a-z]{4,}\b', p.title.lower())
            all_keywords.extend(words)

        # Count keyword frequency
        keyword_counts = defaultdict(int)
        for kw in all_keywords:
            keyword_counts[kw.lower()] += 1

        # Find mentioned but understudied topics
        query_terms = set(query.lower().split())

        # Check for combinations that are rare
        common_terms = [k for k, v in keyword_counts.items() if v >= 3]

        for term in common_terms:
            # Check for each term combined with query
            combined_count = sum(
                1 for p in papers
                if term in p.title.lower() and any(qt in p.title.lower() for qt in query_terms)
            )

            if combined_count < 2 and keyword_counts[term] >= 5:
                gaps.append(Gap(
                    type='topic',
                    description=f"'{term}' is common in the field but rarely studied in relation to {query}",
                    severity='medium',
                    evidence=[f"Found {keyword_counts[term]} papers mentioning '{term}' but only {combined_count} combining it with the query topic"],
                    suggested_research=f"Investigate the relationship between {term} and {query}",
                    related_papers=[p.id for p in papers if term in p.title.lower()][:5],
                    confidence=0.7
                ))

        return gaps[:5]  # Limit to top 5 topic gaps

    def _analyze_methodology_gaps(self, papers: List[Paper]) -> List[Gap]:
        """Identify gaps in research methodologies"""
        gaps = []

        # Detect methodologies in papers
        method_counts = defaultdict(int)
        for paper in papers:
            text = (paper.abstract + ' ' + (paper.methodology or '')).lower()
            for method in self.METHODOLOGIES:
                if method in text:
                    method_counts[method] += 1

        total_papers = len(papers)

        # Check for missing rigorous methods
        if method_counts.get('randomized controlled trial', 0) + method_counts.get('rct', 0) < total_papers * 0.1:
            gaps.append(Gap(
                type='methodology',
                description='Limited randomized controlled trials in this research area',
                severity='high',
                evidence=[f"Only {method_counts.get('rct', 0) + method_counts.get('randomized controlled trial', 0)} RCTs found in {total_papers} papers"],
                suggested_research='Conduct randomized controlled trials to establish causal relationships',
                related_papers=[],
                confidence=0.85
            ))

        if method_counts.get('meta-analysis', 0) + method_counts.get('systematic review', 0) < 3:
            gaps.append(Gap(
                type='methodology',
                description='Few systematic reviews or meta-analyses available',
                severity='medium',
                evidence=['Insufficient synthesis of existing evidence'],
                suggested_research='Conduct systematic reviews to synthesize existing findings',
                related_papers=[],
                confidence=0.8
            ))

        if method_counts.get('longitudinal', 0) < total_papers * 0.05:
            gaps.append(Gap(
                type='methodology',
                description='Lack of longitudinal studies tracking outcomes over time',
                severity='medium',
                evidence=[f"Only {method_counts.get('longitudinal', 0)} longitudinal studies found"],
                suggested_research='Design longitudinal studies to understand temporal patterns',
                related_papers=[],
                confidence=0.75
            ))

        return gaps

    def _analyze_temporal_gaps(self, papers: List[Paper]) -> List[Gap]:
        """Identify temporal gaps in research"""
        gaps = []

        # Group papers by year
        by_year = defaultdict(list)
        for p in papers:
            by_year[p.year].append(p)

        if not by_year:
            return gaps

        years = sorted(by_year.keys())
        current_year = datetime.now().year

        # Check for recent decline in research
        recent_years = [y for y in years if y >= current_year - 3]
        older_years = [y for y in years if current_year - 6 <= y < current_year - 3]

        if recent_years and older_years:
            recent_avg = sum(len(by_year[y]) for y in recent_years) / len(recent_years)
            older_avg = sum(len(by_year[y]) for y in older_years) / len(older_years)

            if recent_avg < older_avg * 0.5:
                gaps.append(Gap(
                    type='temporal',
                    description='Declining research activity in recent years',
                    severity='medium',
                    evidence=[f"Average papers per year dropped from {older_avg:.1f} to {recent_avg:.1f}"],
                    suggested_research='Renewed research attention may be needed in this area',
                    related_papers=[],
                    confidence=0.7
                ))

        # Check for year gaps
        for i in range(len(years) - 1):
            if years[i+1] - years[i] >= 3:
                gaps.append(Gap(
                    type='temporal',
                    description=f'Research gap between {years[i]} and {years[i+1]}',
                    severity='low',
                    evidence=[f'No publications found for {years[i+1] - years[i] - 1} years'],
                    suggested_research='Review what changed during this period',
                    related_papers=[],
                    confidence=0.6
                ))

        return gaps

    def _analyze_population_gaps(self, papers: List[Paper]) -> List[Gap]:
        """Identify gaps in population coverage"""
        gaps = []

        # Count population mentions
        pop_counts = defaultdict(int)
        for paper in papers:
            text = (paper.abstract + ' ' + (paper.population or '')).lower()
            for pop in self.POPULATIONS:
                if pop in text:
                    pop_counts[pop] += 1

        total = len(papers)

        # Check for underrepresented populations
        underrepresented = [
            ('pediatric', 'children'),
            ('elderly', 'geriatric'),
            ('minority',),
            ('rural',),
        ]

        for pop_group in underrepresented:
            count = sum(pop_counts.get(p, 0) for p in pop_group)
            if count < total * 0.1:
                gaps.append(Gap(
                    type='population',
                    description=f'Underrepresentation of {pop_group[0]} populations in research',
                    severity='high' if count == 0 else 'medium',
                    evidence=[f'Only {count} of {total} papers specifically address this population'],
                    suggested_research=f'Conduct studies specifically targeting {pop_group[0]} populations',
                    related_papers=[],
                    confidence=0.8
                ))

        return gaps

    def _analyze_citation_network(self, papers: List[Paper]) -> List[Gap]:
        """Analyze citation network for structural gaps"""
        gaps = []

        # Build citation graph
        cited_by = defaultdict(set)  # paper -> papers that cite it
        cites = defaultdict(set)  # paper -> papers it cites

        paper_ids = {p.id for p in papers}

        for paper in papers:
            for ref in paper.references:
                if ref in paper_ids:
                    cited_by[ref].add(paper.id)
                    cites[paper.id].add(ref)

        # Find isolated clusters (papers that don't cite each other)
        # This is simplified - full implementation would use graph algorithms

        # Find highly cited but not citing back (potential foundational gaps)
        for paper in papers:
            if len(cited_by.get(paper.id, set())) > 5 and len(cites.get(paper.id, set())) == 0:
                gaps.append(Gap(
                    type='network',
                    description=f'Paper "{paper.title[:50]}..." is frequently cited but may not connect to recent work',
                    severity='low',
                    evidence=[f'Cited by {len(cited_by[paper.id])} papers but references 0 papers in dataset'],
                    suggested_research='Update foundational work with recent findings',
                    related_papers=[paper.id],
                    confidence=0.5
                ))

        return gaps[:3]  # Limit network gaps

    def _calculate_topic_coverage(self, papers: List[Paper]) -> Dict[str, int]:
        """Calculate coverage of different topics"""
        coverage = defaultdict(int)
        for paper in papers:
            for kw in paper.keywords[:5]:  # Top 5 keywords per paper
                coverage[kw.lower()] += 1

        # Return top 20 topics
        return dict(sorted(coverage.items(), key=lambda x: x[1], reverse=True)[:20])

    def _calculate_methodology_distribution(self, papers: List[Paper]) -> Dict[str, int]:
        """Calculate distribution of methodologies"""
        dist = defaultdict(int)
        for paper in papers:
            text = (paper.abstract + ' ' + (paper.methodology or '')).lower()
            for method in self.METHODOLOGIES:
                if method in text:
                    dist[method] += 1
        return dict(dist)

    def _calculate_temporal_trends(self, papers: List[Paper]) -> Dict[int, int]:
        """Calculate papers per year"""
        trends = defaultdict(int)
        for paper in papers:
            trends[paper.year] += 1
        return dict(sorted(trends.items()))

    def _calculate_network_stats(self, papers: List[Paper]) -> Dict[str, Any]:
        """Calculate citation network statistics"""
        total_citations = sum(len(p.citations) for p in papers)
        total_references = sum(len(p.references) for p in papers)

        return {
            'total_papers': len(papers),
            'total_citations': total_citations,
            'total_references': total_references,
            'avg_citations': total_citations / len(papers) if papers else 0,
            'avg_references': total_references / len(papers) if papers else 0
        }

    def _generate_recommendations(self, gaps: List[Gap]) -> List[str]:
        """Generate research recommendations based on gaps"""
        recommendations = []

        # Prioritize high severity gaps
        high_severity = [g for g in gaps if g.severity == 'high']

        for gap in high_severity[:3]:
            recommendations.append(f"Priority: {gap.suggested_research}")

        # Add general recommendations based on gap types
        gap_types = {g.type for g in gaps}

        if 'methodology' in gap_types:
            recommendations.append("Consider more rigorous study designs (RCTs, systematic reviews)")

        if 'population' in gap_types:
            recommendations.append("Expand research to underrepresented populations")

        if 'temporal' in gap_types:
            recommendations.append("Update older studies with current data and methods")

        return recommendations[:7]


# Convenience function
def analyze_gaps(papers: List[Paper], query: str) -> GapAnalysisResult:
    """Analyze research gaps in a set of papers"""
    analyzer = GapAnalyzer()
    return analyzer.analyze(papers, query)
