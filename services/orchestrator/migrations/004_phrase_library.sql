-- Migration: 004_phrase_library
-- Phase 4.2: Phrase library tables for academic writing assistance

-- Phrase library table
CREATE TABLE IF NOT EXISTS phrase_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  rationale TEXT,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_phrase_category ON phrase_library(category);
CREATE INDEX IF NOT EXISTS idx_phrase_tags ON phrase_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_phrase_usage ON phrase_library(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_phrase_search ON phrase_library USING GIN(
  to_tsvector('english', phrase || ' ' || COALESCE(rationale, ''))
);

-- User favorites table
CREATE TABLE IF NOT EXISTS phrase_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phrase_id UUID NOT NULL REFERENCES phrase_library(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phrase_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON phrase_favorites(user_id);

-- AI tool usage tracking
CREATE TABLE IF NOT EXISTS writing_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  manuscript_id UUID,
  tool_name VARCHAR(50) NOT NULL,
  input_length INT,
  output_length INT,
  execution_time_ms INT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_user ON writing_tool_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON writing_tool_usage(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_usage_date ON writing_tool_usage(created_at DESC);

-- Insert default academic phrases
INSERT INTO phrase_library (phrase, category, tags, rationale) VALUES
-- Introduction phrases
('This study aims to investigate', 'introduction', ARRAY['opening', 'objective'], 'Standard opening for research objectives'),
('The purpose of this research is to', 'introduction', ARRAY['opening', 'purpose'], 'Clear statement of research purpose'),
('Despite extensive research, there remains a gap in', 'introduction', ARRAY['gap', 'rationale'], 'Identifies research gap'),
('Building upon previous work by', 'introduction', ARRAY['background', 'foundation'], 'Acknowledges prior research'),
('To address this limitation, we propose', 'introduction', ARRAY['solution', 'contribution'], 'Introduces novel contribution'),

-- Methods phrases
('Participants were recruited from', 'methods', ARRAY['recruitment', 'participants'], 'Standard recruitment description'),
('Data were collected using', 'methods', ARRAY['data collection', 'instruments'], 'Introduces data collection methods'),
('Statistical analyses were performed using', 'methods', ARRAY['analysis', 'statistics'], 'Standard statistical methods intro'),
('Informed consent was obtained from all participants', 'methods', ARRAY['ethics', 'consent'], 'Ethics statement'),
('The study protocol was approved by', 'methods', ARRAY['ethics', 'IRB'], 'IRB approval statement'),

-- Results phrases
('Our findings demonstrate that', 'results', ARRAY['findings', 'main result'], 'Introduces key findings'),
('A statistically significant difference was observed', 'results', ARRAY['statistics', 'significance'], 'Reports significant result'),
('No significant difference was found between', 'results', ARRAY['statistics', 'null result'], 'Reports non-significant result'),
('As shown in Table', 'results', ARRAY['reference', 'table'], 'References data tables'),
('Figure X illustrates', 'results', ARRAY['reference', 'figure'], 'References figures'),

-- Discussion phrases
('These findings are consistent with', 'discussion', ARRAY['comparison', 'support'], 'Compares with existing literature'),
('In contrast to previous studies', 'discussion', ARRAY['comparison', 'contrast'], 'Highlights differences'),
('One possible explanation for this finding is', 'discussion', ARRAY['interpretation', 'mechanism'], 'Explains results'),
('The clinical implications of these findings include', 'discussion', ARRAY['implications', 'clinical'], 'Discusses clinical relevance'),
('Future research should examine', 'discussion', ARRAY['future', 'recommendations'], 'Suggests future directions'),

-- Limitation phrases
('This study has several limitations that should be considered', 'limitation', ARRAY['introduction', 'caveat'], 'Opens limitations section'),
('The relatively small sample size may limit', 'limitation', ARRAY['sample size', 'generalizability'], 'Sample size limitation'),
('The retrospective nature of this study', 'limitation', ARRAY['design', 'retrospective'], 'Study design limitation'),
('Selection bias may have influenced', 'limitation', ARRAY['bias', 'selection'], 'Selection bias acknowledgment'),
('Despite these limitations, our findings provide', 'limitation', ARRAY['strength', 'contribution'], 'Balances limitations with strengths'),

-- Transition phrases
('Building upon these findings', 'transition', ARRAY['forward', 'continuation'], 'Moves discussion forward'),
('Taken together, these results suggest', 'transition', ARRAY['synthesis', 'summary'], 'Synthesizes multiple findings'),
('In addition to the aforementioned', 'transition', ARRAY['addition', 'supplementary'], 'Adds additional points'),
('However, it is important to note that', 'transition', ARRAY['contrast', 'caveat'], 'Introduces counterpoint'),
('Furthermore, our analysis revealed', 'transition', ARRAY['addition', 'discovery'], 'Introduces additional finding'),

-- Hedging phrases
('These results suggest that', 'hedging', ARRAY['tentative', 'interpretation'], 'Cautious interpretation'),
('It is possible that', 'hedging', ARRAY['possibility', 'speculation'], 'Introduces possibility'),
('Our findings may indicate', 'hedging', ARRAY['tentative', 'implication'], 'Tentative implication'),
('This appears to be consistent with', 'hedging', ARRAY['tentative', 'comparison'], 'Cautious comparison'),
('Further research is needed to confirm', 'hedging', ARRAY['caveat', 'future'], 'Acknowledges need for validation'),

-- Citation context phrases
('As demonstrated by', 'citation', ARRAY['support', 'evidence'], 'Introduces supporting citation'),
('Consistent with the findings of', 'citation', ARRAY['support', 'agreement'], 'Shows agreement with prior work'),
('In contrast to the results reported by', 'citation', ARRAY['contrast', 'disagreement'], 'Introduces contrasting citation'),
('Building on the seminal work of', 'citation', ARRAY['foundation', 'acknowledgment'], 'Acknowledges foundational work'),
('Recent evidence suggests', 'citation', ARRAY['recent', 'current'], 'Introduces recent research')

ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_phrase_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS phrase_updated_at ON phrase_library;
CREATE TRIGGER phrase_updated_at
  BEFORE UPDATE ON phrase_library
  FOR EACH ROW
  EXECUTE FUNCTION update_phrase_updated_at();

-- View for phrase analytics
CREATE OR REPLACE VIEW phrase_analytics AS
SELECT 
  category,
  COUNT(*) as phrase_count,
  SUM(usage_count) as total_usage,
  AVG(usage_count) as avg_usage,
  array_agg(DISTINCT unnest) as all_tags
FROM phrase_library, LATERAL unnest(tags)
GROUP BY category
ORDER BY total_usage DESC;

-- Comments for documentation
COMMENT ON TABLE phrase_library IS 'Academic phrases for manuscript writing assistance';
COMMENT ON TABLE phrase_favorites IS 'User favorite phrases for quick access';
COMMENT ON TABLE writing_tool_usage IS 'Usage tracking for AI writing tools';
COMMENT ON COLUMN phrase_library.rationale IS 'Explanation of when/why to use this phrase';
