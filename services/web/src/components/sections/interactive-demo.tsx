import { ManuscriptIdeationPanel } from '@/components/manuscript-ideation';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import type { ManuscriptIdeationInput, ManuscriptProposal } from '@packages/core/types';

export function InteractiveDemo() {
  const handleGenerate = async (inputs: ManuscriptIdeationInput): Promise<ManuscriptProposal[]> => {
    const response = await apiRequest('POST', '/api/demo/generate-proposals', inputs);
    const data = await response.json();
    return data.proposals;
  };

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-muted/30 to-background" data-testid="section-interactive-demo">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-blue-100 text-blue-700 border-blue-200" data-testid="badge-demo-section">
            Try It Now
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-demo-heading">
            Generate Manuscript Ideas
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-demo-description">
            Enter your research topic and see how ROS generates tailored manuscript proposals with relevance scores and target journals.
          </p>
        </motion.div>

        <ManuscriptIdeationPanel
          mode="demo"
          onGenerate={handleGenerate}
        />
      </div>
    </section>
  );
}
