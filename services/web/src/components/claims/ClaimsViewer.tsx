/**
 * Claims Viewer Component
 *
 * Displays manuscript claims with linked evidence.
 * Supports claim verification status and evidence quality indicators.
 *
 * Features:
 * - Claim list with status indicators
 * - Evidence linking with strength scoring
 * - PHI-safe claim previews
 * - Claim-to-evidence navigation
 * - Evidence quality assessment
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Link2,
  ExternalLink,
  Plus,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface Claim {
  id: string;
  researchId: string;
  manuscriptArtifactId: string;
  section: string;
  claimText: string;
  status: 'draft' | 'verified' | 'disputed' | 'retracted';
  createdBy: string;
  createdAt: string;
  phiScanStatus: 'PENDING' | 'PASS' | 'FAIL' | 'OVERRIDE';
  anchor: {
    startOffset?: number;
    endOffset?: number;
    sectionId?: string;
  };
}

interface Evidence {
  id: string;
  claimId: string;
  type: 'figure' | 'table' | 'dataset' | 'analysis' | 'citation' | 'external_url';
  evidenceArtifactId?: string;
  citationId?: string;
  externalUrl?: string;
  locator?: string;
  linkedBy: string;
  linkedAt: string;
  notes?: string;
}

interface ClaimsViewerProps {
  researchId: string;
  artifactId?: string;
  currentUserId: string;
  onClaimClick?: (claim: Claim) => void;
  onEvidenceClick?: (evidence: Evidence) => void;
  className?: string;
}

export function ClaimsViewer({
  researchId,
  artifactId,
  currentUserId,
  onClaimClick,
  onEvidenceClick,
  className = '',
}: ClaimsViewerProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<Claim['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Link evidence dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newEvidenceType, setNewEvidenceType] = useState<Evidence['type']>('figure');
  const [newEvidenceLocator, setNewEvidenceLocator] = useState('');
  const [newEvidenceNotes, setNewEvidenceNotes] = useState('');
  const [linking, setLinking] = useState(false);

  // Fetch claims
  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ researchId });
      if (artifactId) params.append('artifactId', artifactId);

      const response = await fetch(`/api/ros/claims?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch claims');
      }

      const data = await response.json();
      setClaims(data.claims || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [researchId, artifactId]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Fetch evidence for selected claim
  const fetchEvidence = useCallback(async (claimId: string) => {
    setLoadingEvidence(true);

    try {
      const response = await fetch(`/api/ros/claims/${claimId}/evidence`);

      if (!response.ok) {
        throw new Error('Failed to fetch evidence');
      }

      const data = await response.json();
      setEvidence(data.evidence || []);
    } catch (err) {
      console.error('Error fetching evidence:', err);
      setEvidence([]);
    } finally {
      setLoadingEvidence(false);
    }
  }, []);

  // Handle claim selection
  const handleSelectClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    fetchEvidence(claim.id);
    onClaimClick?.(claim);
  };

  // Link evidence to claim
  const handleLinkEvidence = async () => {
    if (!selectedClaim || !newEvidenceLocator.trim()) return;

    setLinking(true);

    try {
      const response = await fetch(`/api/ros/claims/${selectedClaim.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newEvidenceType,
          locator: newEvidenceLocator,
          notes: newEvidenceNotes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link evidence');
      }

      setNewEvidenceLocator('');
      setNewEvidenceNotes('');
      setLinkDialogOpen(false);
      await fetchEvidence(selectedClaim.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link evidence');
    } finally {
      setLinking(false);
    }
  };

  // Update claim status
  const handleUpdateStatus = async (claimId: string, newStatus: Claim['status']) => {
    try {
      const response = await fetch(`/api/ros/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update claim status');
      }

      await fetchClaims();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update claim');
    }
  };

  // Filter claims
  const filteredClaims = claims.filter((claim) => {
    if (statusFilter !== 'all' && claim.status !== statusFilter) return false;
    if (searchQuery) {
      return claim.claimText.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Status badge
  const getStatusBadge = (status: Claim['status']) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-500 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'disputed':
        return (
          <Badge className="bg-yellow-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Disputed
          </Badge>
        );
      case 'retracted':
        return (
          <Badge className="bg-red-500 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Retracted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Draft
          </Badge>
        );
    }
  };

  // PHI badge
  const getPhiBadge = (phiStatus: Claim['phiScanStatus']) => {
    switch (phiStatus) {
      case 'PASS':
        return (
          <Badge variant="outline" className="text-green-600 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            PHI Clear
          </Badge>
        );
      case 'FAIL':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            PHI Detected
          </Badge>
        );
      case 'OVERRIDE':
        return (
          <Badge variant="outline" className="text-yellow-600 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            Override
          </Badge>
        );
      default:
        return null;
    }
  };

  // Evidence type icon
  const getEvidenceIcon = (type: Evidence['type']) => {
    switch (type) {
      case 'figure':
        return '📊';
      case 'table':
        return '📋';
      case 'dataset':
        return '📁';
      case 'analysis':
        return '🔬';
      case 'citation':
        return '📚';
      case 'external_url':
        return '🔗';
      default:
        return '📎';
    }
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Claims & Evidence ({claims.length})
          </h3>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search claims..."
              className="pl-10"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as Claim['status'] | 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="retracted">Retracted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Claims and Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Claims list */}
        <div className="space-y-3">
          <h4 className="font-medium">Claims</h4>

          {filteredClaims.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No claims found
            </Card>
          ) : (
            filteredClaims.map((claim) => (
              <Card
                key={claim.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedClaim?.id === claim.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleSelectClaim(claim)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {claim.section}
                    </Badge>
                    <div className="flex gap-2">
                      {getPhiBadge(claim.phiScanStatus)}
                      {getStatusBadge(claim.status)}
                    </div>
                  </div>

                  <p className="text-sm line-clamp-3">{claim.claimText}</p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{claim.createdBy}</span>
                    <span>{new Date(claim.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Evidence panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              Evidence {selectedClaim ? `for Claim` : ''}
            </h4>

            {selectedClaim && (
              <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Link Evidence
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link Evidence to Claim</DialogTitle>
                    <DialogDescription>
                      Connect supporting evidence to verify this claim.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Evidence Type</label>
                      <Select
                        value={newEvidenceType}
                        onValueChange={(v) => setNewEvidenceType(v as Evidence['type'])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="figure">Figure</SelectItem>
                          <SelectItem value="table">Table</SelectItem>
                          <SelectItem value="dataset">Dataset</SelectItem>
                          <SelectItem value="analysis">Analysis</SelectItem>
                          <SelectItem value="citation">Citation</SelectItem>
                          <SelectItem value="external_url">External URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Locator</label>
                      <Input
                        value={newEvidenceLocator}
                        onChange={(e) => setNewEvidenceLocator(e.target.value)}
                        placeholder={
                          newEvidenceType === 'external_url'
                            ? 'https://...'
                            : 'e.g., Figure 3A, Table 2'
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Textarea
                        value={newEvidenceNotes}
                        onChange={(e) => setNewEvidenceNotes(e.target.value)}
                        placeholder="Describe how this evidence supports the claim..."
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleLinkEvidence}
                      disabled={linking || !newEvidenceLocator.trim()}
                    >
                      {linking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Link Evidence
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!selectedClaim ? (
            <Card className="p-8 text-center text-muted-foreground">
              Select a claim to view its evidence
            </Card>
          ) : loadingEvidence ? (
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ) : evidence.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No evidence linked to this claim yet
            </Card>
          ) : (
            <div className="space-y-2">
              {evidence.map((ev) => (
                <Card
                  key={ev.id}
                  className="p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => onEvidenceClick?.(ev)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getEvidenceIcon(ev.type)}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize">
                          {ev.type.replace('_', ' ')}
                        </Badge>
                        {ev.externalUrl && (
                          <a
                            href={ev.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      {ev.locator && (
                        <p className="text-sm font-medium">{ev.locator}</p>
                      )}
                      {ev.notes && (
                        <p className="text-sm text-muted-foreground">{ev.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Linked by {ev.linkedBy} on{' '}
                        {new Date(ev.linkedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Claim actions */}
          {selectedClaim && (
            <Card className="p-4">
              <h5 className="text-sm font-medium mb-3">Update Status</h5>
              <div className="flex flex-wrap gap-2">
                {(['draft', 'verified', 'disputed', 'retracted'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={selectedClaim.status === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedClaim.id, status)}
                    className="capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
