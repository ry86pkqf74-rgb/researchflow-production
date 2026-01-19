/**
 * Citation Formatter Component
 *
 * Allows users to input citation details and format them
 * in multiple academic citation styles.
 */

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Copy,
  Check,
  Plus,
  Trash2,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  Citation,
  Author,
  CitationStyle,
  FormattedCitation,
  CitationFormatterProps,
} from "./types";

const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  { value: "apa", label: "APA 7th Edition" },
  { value: "mla", label: "MLA 9th Edition" },
  { value: "chicago", label: "Chicago 17th Edition" },
  { value: "harvard", label: "Harvard" },
  { value: "vancouver", label: "Vancouver" },
  { value: "ieee", label: "IEEE" },
  { value: "ama", label: "AMA" },
];

const CITATION_TYPES = [
  { value: "journal", label: "Journal Article" },
  { value: "book", label: "Book" },
  { value: "chapter", label: "Book Chapter" },
  { value: "conference", label: "Conference Paper" },
  { value: "thesis", label: "Thesis/Dissertation" },
  { value: "website", label: "Website" },
  { value: "report", label: "Report" },
];

function AuthorInput({
  authors,
  onChange,
}: {
  authors: Author[];
  onChange: (authors: Author[]) => void;
}) {
  const addAuthor = () => {
    onChange([...authors, { firstName: "", lastName: "" }]);
  };

  const removeAuthor = (index: number) => {
    onChange(authors.filter((_, i) => i !== index));
  };

  const updateAuthor = (index: number, field: keyof Author, value: string) => {
    const updated = [...authors];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center justify-between">
        Authors
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addAuthor}
          className="h-6 px-2"
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </Label>
      {authors.map((author, index) => (
        <div key={index} className="flex gap-2 items-center">
          <Input
            placeholder="First name"
            value={author.firstName}
            onChange={(e) => updateAuthor(index, "firstName", e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Last name"
            value={author.lastName}
            onChange={(e) => updateAuthor(index, "lastName", e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Suffix"
            value={author.suffix || ""}
            onChange={(e) => updateAuthor(index, "suffix", e.target.value)}
            className="w-20"
          />
          {authors.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAuthor(index)}
              className="h-8 w-8 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function FormattedCitationCard({
  formatted,
  onCopy,
}: {
  formatted: FormattedCitation;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(formatted.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="uppercase text-xs">
              {formatted.style}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed">{formatted.text}</p>
          <p className="text-xs text-muted-foreground mt-2">
            In-text: {formatted.inTextCitation}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-8 w-8"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Card>
  );
}

export function CitationFormatter({
  citation: initialCitation,
  onFormatted,
}: CitationFormatterProps) {
  const [citation, setCitation] = useState<Partial<Citation>>(
    initialCitation || {
      type: "journal",
      title: "",
      authors: [{ firstName: "", lastName: "" }],
      year: new Date().getFullYear(),
    }
  );

  const [selectedStyles, setSelectedStyles] = useState<CitationStyle[]>(["apa"]);
  const [formattedCitations, setFormattedCitations] = useState<FormattedCitation[]>([]);
  const [bibtexInput, setBibtexInput] = useState("");
  const [activeTab, setActiveTab] = useState("manual");

  const formatMutation = useMutation({
    mutationFn: async (data: { citation: Citation; styles: CitationStyle[] }) => {
      const response = await apiRequest("POST", "/api/literature/format-citation", data);
      return response.json();
    },
    onSuccess: (data) => {
      setFormattedCitations(data.formatted);
      onFormatted?.(data.formatted);
    },
  });

  const parseBibtexMutation = useMutation({
    mutationFn: async (bibtex: string) => {
      const response = await apiRequest("POST", "/api/literature/parse-bibtex", { bibtex });
      return response.json();
    },
    onSuccess: (data) => {
      setCitation(data.citation);
      setActiveTab("manual");
    },
  });

  const handleFormat = useCallback(() => {
    if (!citation.title || !citation.authors?.length) return;
    formatMutation.mutate({
      citation: citation as Citation,
      styles: selectedStyles,
    });
  }, [citation, selectedStyles, formatMutation]);

  const handleParseBibtex = useCallback(() => {
    if (!bibtexInput.trim()) return;
    parseBibtexMutation.mutate(bibtexInput);
  }, [bibtexInput, parseBibtexMutation]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownloadBibtex = async () => {
    const response = await apiRequest("POST", "/api/literature/to-bibtex", {
      citation,
    });
    const data = await response.json();
    const blob = new Blob([data.bibtex], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "citation.bib";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleStyle = (style: CitationStyle) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Citation Formatter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="bibtex">Import BibTeX</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={citation.type}
                  onValueChange={(v) =>
                    setCitation((prev) => ({ ...prev, type: v as Citation["type"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CITATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={citation.year || ""}
                  onChange={(e) =>
                    setCitation((prev) => ({
                      ...prev,
                      year: parseInt(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={citation.title || ""}
                onChange={(e) =>
                  setCitation((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter the title"
              />
            </div>

            <AuthorInput
              authors={citation.authors || [{ firstName: "", lastName: "" }]}
              onChange={(authors) => setCitation((prev) => ({ ...prev, authors }))}
            />

            {(citation.type === "journal" || citation.type === "conference") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {citation.type === "journal" ? "Journal Name" : "Conference Name"}
                  </Label>
                  <Input
                    value={citation.journal || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, journal: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>DOI</Label>
                  <Input
                    value={citation.doi || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, doi: e.target.value }))
                    }
                    placeholder="10.xxxx/xxxxx"
                  />
                </div>
              </div>
            )}

            {citation.type === "journal" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Volume</Label>
                  <Input
                    value={citation.volume || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, volume: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Issue</Label>
                  <Input
                    value={citation.issue || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, issue: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pages</Label>
                  <Input
                    value={citation.pages || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, pages: e.target.value }))
                    }
                    placeholder="1-10"
                  />
                </div>
              </div>
            )}

            {(citation.type === "book" || citation.type === "chapter") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Publisher</Label>
                  <Input
                    value={citation.publisher || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, publisher: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>ISBN</Label>
                  <Input
                    value={citation.isbn || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, isbn: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {citation.type === "website" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={citation.url || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Access Date</Label>
                  <Input
                    type="date"
                    value={citation.accessDate || ""}
                    onChange={(e) =>
                      setCitation((prev) => ({ ...prev, accessDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bibtex" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Paste BibTeX</Label>
              <Textarea
                value={bibtexInput}
                onChange={(e) => setBibtexInput(e.target.value)}
                placeholder="@article{key,&#10;  author = {...},&#10;  title = {...},&#10;  ...&#10;}"
                className="font-mono text-sm min-h-[150px]"
              />
            </div>
            <Button
              onClick={handleParseBibtex}
              disabled={parseBibtexMutation.isPending || !bibtexInput.trim()}
            >
              {parseBibtexMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Parse BibTeX
            </Button>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>Output Styles</Label>
          <div className="flex flex-wrap gap-2">
            {CITATION_STYLES.map((style) => (
              <Badge
                key={style.value}
                variant={selectedStyles.includes(style.value) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleStyle(style.value)}
              >
                {style.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleFormat}
            disabled={formatMutation.isPending || !citation.title}
            className="flex-1"
          >
            {formatMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4 mr-2" />
            )}
            Format Citation
          </Button>
          <Button variant="outline" onClick={handleDownloadBibtex}>
            <Download className="h-4 w-4 mr-2" />
            Export BibTeX
          </Button>
        </div>

        {formattedCitations.length > 0 && (
          <div className="space-y-3">
            <Label>Formatted Citations</Label>
            {formattedCitations.map((formatted, index) => (
              <FormattedCitationCard
                key={index}
                formatted={formatted}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CitationFormatter;
