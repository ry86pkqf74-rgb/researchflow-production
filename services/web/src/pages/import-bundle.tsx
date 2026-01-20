import { useLocation } from "wouter";
import { BundleImport } from "@/components/import/bundle-import";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ImportBundlePage() {
  const [, navigate] = useLocation();

  const handleImportSuccess = (projectId: string) => {
    // Navigate to home or project page after successful import
    navigate("/");
  };

  const handleCancel = () => {
    navigate("/");
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="mb-4"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-2">Import Project Bundle</h1>
        <p className="text-muted-foreground">
          Upload a research bundle to create a new project with all artifacts and data
        </p>
      </div>

      <BundleImport
        onImportSuccess={handleImportSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
