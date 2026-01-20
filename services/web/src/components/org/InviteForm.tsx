/**
 * Invite Form Component (Task 83)
 *
 * Form for inviting new members to an organization.
 * Supports role selection and email validation.
 */

import { useState } from 'react';
import { UserPlus, Mail, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface InviteFormProps {
  orgId: string;
  currentUserRole: OrgRole;
  onInviteSent?: (email: string, role: OrgRole) => void;
}

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  OWNER: 'Full control including billing and admin',
  ADMIN: 'Manage members, integrations, and settings',
  MEMBER: 'Create and edit research projects',
  VIEWER: 'View-only access to research projects',
};

export function InviteForm({ orgId, currentUserRole, onInviteSent }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Only OWNER can invite ADMIN or OWNER
  const canInviteRole = (targetRole: OrgRole): boolean => {
    if (currentUserRole === 'OWNER') return true;
    if (targetRole === 'OWNER' || targetRole === 'ADMIN') return false;
    return true;
  };

  const availableRoles: OrgRole[] = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'].filter(
    (r) => canInviteRole(r as OrgRole)
  ) as OrgRole[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/org/${orgId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, orgRole: role }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'ALREADY_MEMBER') {
          setError('This user is already a member of the organization');
        } else {
          setError(data.error || 'Failed to send invite');
        }
        return;
      }

      setSuccess(`Invite sent to ${email}`);
      setEmail('');
      onInviteSent?.(email, role);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Member
        </CardTitle>
        <CardDescription>
          Send an invitation to join this organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Role
            </Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as OrgRole)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    <div className="flex flex-col">
                      <span className="font-medium">{r}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[r]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Invite...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
