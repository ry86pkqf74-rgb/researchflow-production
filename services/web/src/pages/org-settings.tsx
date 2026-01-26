/**
 * Organization Settings Page (Task 83)
 *
 * Settings page for organization management including:
 * - Organization details
 * - Member management
 * - Invite management
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Users,
  UserPlus,
  Loader2,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InviteForm, OrgRole } from '@/components/org/InviteForm';
import { MembersList } from '@/components/org/MembersList';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  billingEmail?: string;
  subscriptionTier: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  membership: {
    role: OrgRole;
    joinedAt: string;
    capabilities: string[];
  };
  stats: {
    memberCount: number;
    projectCount: number;
  };
}

interface User {
  id: string;
  email: string;
}

export function OrgSettings() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [billingEmail, setBillingEmail] = useState('');

  // Get orgId from URL params (assuming wouter or similar)
  const orgId = window.location.pathname.split('/org/')[1]?.split('/')[0] || '';

  useEffect(() => {
    const fetchData = async () => {
      if (!orgId) {
        setError('Organization ID not found');
        setLoading(false);
        return;
      }

      try {
        // Fetch org details
        const orgResponse = await fetch(`/api/org/${orgId}`, {
          credentials: 'include',
        });

        if (!orgResponse.ok) {
          throw new Error('Failed to load organization');
        }

        const orgData = await orgResponse.json();
        setOrg(orgData);
        setName(orgData.name || '');
        setDescription(orgData.description || '');
        setBillingEmail(orgData.billingEmail || '');

        // Fetch current user
        const userResponse = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  const handleSaveSettings = async () => {
    if (!org) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/org/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          billingEmail: billingEmail.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update organization');
      }

      const updatedOrg = await response.json();
      setOrg({ ...org, ...updatedOrg });
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteSent = () => {
    // Refresh member list after invite
  };

  const canManage =
    org?.membership.role === 'OWNER' || org?.membership.role === 'ADMIN';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Organization Settings
              </h1>
              <p className="text-muted-foreground">
                Manage {org?.name} settings and members
              </p>
            </div>
          </div>
          <Badge className="text-sm">{org?.subscriptionTier}</Badge>
        </div>

        {/* Notifications */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{org?.stats.projectCount || 0}</p>
                <p className="text-sm text-muted-foreground">Projects</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{org?.stats.memberCount || 0}</p>
                <p className="text-sm text-muted-foreground">Members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-full bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Your Role</p>
                <Badge variant="outline" className="mt-1">
                  {org?.membership.role}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="invite" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Invite
              </TabsTrigger>
            )}
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>
                  Basic information about your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canManage}
                    placeholder="My Organization"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">/org/</span>
                    <Input
                      id="slug"
                      value={org?.slug || ''}
                      disabled
                      className="font-mono"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Organization slug cannot be changed after creation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canManage}
                    placeholder="Describe your organization..."
                    rows={3}
                  />
                </div>

                {org?.membership.role === 'OWNER' && (
                  <div className="space-y-2">
                    <Label htmlFor="billingEmail">Billing Email</Label>
                    <Input
                      id="billingEmail"
                      type="email"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      placeholder="billing@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for billing notifications and invoices
                    </p>
                  </div>
                )}

                {canManage && (
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            {org && user && (
              <MembersList
                orgId={org.id}
                currentUserId={user.id}
                currentUserRole={org.membership.role}
                onMemberUpdated={() => {
                  // Refresh org data to update member count
                  fetch(`/api/org/${orgId}`, { credentials: 'include' })
                    .then((r) => r.json())
                    .then(setOrg)
                    .catch(console.error);
                }}
              />
            )}
          </TabsContent>

          {/* Invite Tab */}
          {canManage && (
            <TabsContent value="invite">
              {org && (
                <InviteForm
                  orgId={org.id}
                  currentUserRole={org.membership.role}
                  onInviteSent={handleInviteSent}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default OrgSettings;
