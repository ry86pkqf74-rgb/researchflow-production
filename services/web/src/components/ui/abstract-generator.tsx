import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Copy,
  Check,
  FileText,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ResearchBrief } from "@packages/core/types";
import {
  generateAbstract,
  countWords,
  getWordLimitRecommendation,
} from "@/lib/abstract-generator";

type WordLimitOption = 150 | 250 | 350;

interface AbstractGeneratorProps {
  researchBrief: ResearchBrief;
  wordLimit?: WordLimitOption;
  onAbstractChange?: (abstract: string) => void;
}

const WORD_LIMIT_OPTIONS: { value: WordLimitOption; label: string }[] = [
  { value: 150, label: "150 words" },
  { value: 250, label: "250 words" },
  { value: 350, label: "350 words" },
];

export function AbstractGenerator({
  researchBrief,
  wordLimit: initialWordLimit = 250,
  onAbstractChange,
}: AbstractGeneratorProps) {
  const [wordLimit, setWordLimit] = useState<WordLimitOption>(initialWordLimit);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [regenerateKey, setRegenerateKey] = useState(0);

  const generatedAbstract = useMemo(
    () => generateAbstract(researchBrief, wordLimit),
    [researchBrief, wordLimit, regenerateKey]
  );

  const displayText = isEditing ? editedText : generatedAbstract.fullText;
  const currentWordCount = countWords(displayText);
  const isOverLimit = currentWordCount > wordLimit;
  const wordPercentage = Math.min((currentWordCount / wordLimit) * 100, 100);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  }, [displayText]);

  const handleRegenerate = useCallback(() => {
    setRegenerateKey((k) => k + 1);
    setIsEditing(false);
    setEditedText("");
  }, []);

  const handleWordLimitChange = useCallback((value: string) => {
    const newLimit = parseInt(value, 10) as WordLimitOption;
    setWordLimit(newLimit);
    setIsEditing(false);
    setEditedText("");
  }, []);

  const handleEdit = useCallback(() => {
    if (!isEditing) {
      setEditedText(generatedAbstract.fullText);
    }
    setIsEditing(!isEditing);
  }, [isEditing, generatedAbstract.fullText]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setEditedText(newText);
      onAbstractChange?.(newText);
    },
    [onAbstractChange]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-ros-workflow/20 bg-gradient-to-br from-ros-workflow/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-ros-workflow" />
              <CardTitle className="text-lg">Abstract Generator</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Structured
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="gap-1"
                data-testid="button-edit-abstract"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isEditing ? "View" : "Edit"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                className="gap-1"
                data-testid="button-regenerate-abstract"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCopy}
                className="gap-1"
                data-testid="button-copy-abstract"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
          <CardDescription>
            Generate structured abstracts from your research brief
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Word Limit</Label>
              <RadioGroup
                value={wordLimit.toString()}
                onValueChange={handleWordLimitChange}
                className="flex gap-3"
                data-testid="radio-word-limit"
              >
                {WORD_LIMIT_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={option.value.toString()}
                      id={`limit-${option.value}`}
                      data-testid={`radio-limit-${option.value}`}
                    />
                    <Label
                      htmlFor={`limit-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="text-xs text-muted-foreground">
              {getWordLimitRecommendation(wordLimit)}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Word Count</span>
                <Badge
                  variant={isOverLimit ? "destructive" : "secondary"}
                  className="text-xs gap-1"
                >
                  {isOverLimit ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  {currentWordCount} / {wordLimit}
                </Badge>
              </div>
              <AnimatePresence>
                {isOverLimit && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-xs text-destructive"
                  >
                    {currentWordCount - wordLimit} words over limit
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <Progress
              value={wordPercentage}
              className={isOverLimit ? "[&>div]:bg-destructive" : ""}
            />
          </div>

          {isEditing ? (
            <Textarea
              value={editedText}
              onChange={handleTextChange}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Edit your abstract..."
              data-testid="textarea-abstract-edit"
            />
          ) : (
            <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
              <div className="space-y-4" data-testid="text-abstract-display">
                <AbstractSection
                  title="Background"
                  content={generatedAbstract.background.content}
                  wordCount={generatedAbstract.background.wordCount}
                />
                <AbstractSection
                  title="Objective"
                  content={generatedAbstract.objective.content}
                  wordCount={generatedAbstract.objective.wordCount}
                />
                <AbstractSection
                  title="Methods"
                  content={generatedAbstract.methods.content}
                  wordCount={generatedAbstract.methods.wordCount}
                />
                <AbstractSection
                  title="Results"
                  content={generatedAbstract.results.content}
                  wordCount={generatedAbstract.results.wordCount}
                  isPlaceholder
                />
                <AbstractSection
                  title="Conclusion"
                  content={generatedAbstract.conclusion.content}
                  wordCount={generatedAbstract.conclusion.wordCount}
                />
              </div>
            </ScrollArea>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Structure: IMRAD format (Background, Objective, Methods, Results, Conclusion)</span>
            <span>Total sections: 5</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface AbstractSectionProps {
  title: string;
  content: string;
  wordCount: number;
  isPlaceholder?: boolean;
}

function AbstractSection({ title, content, wordCount, isPlaceholder }: AbstractSectionProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h4
          className={`text-sm font-semibold ${
            isPlaceholder ? "text-muted-foreground" : "text-ros-workflow"
          }`}
        >
          {title}
        </h4>
        <Badge variant="outline" className="text-[10px]">
          {wordCount} words
        </Badge>
      </div>
      <p
        className={`text-sm leading-relaxed ${
          isPlaceholder ? "text-muted-foreground italic" : "text-foreground"
        }`}
      >
        {content}
      </p>
    </div>
  );
}

export function AbstractPreview({
  researchBrief,
  wordLimit = 250,
}: {
  researchBrief: ResearchBrief;
  wordLimit?: WordLimitOption;
}) {
  const abstract = generateAbstract(researchBrief, wordLimit);
  const preview = abstract.background.content.slice(0, 150) + "...";

  return (
    <Card className="border-muted">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Abstract Preview</p>
              <Badge variant="outline" className="text-[10px]">
                {abstract.totalWords} words
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{preview}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
