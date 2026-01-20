/**
 * Members List Component (Task 83)
 *
 * Displays organization members with role management.
 * Supports role changes and member removal based on permissions.
 */

import { useState, useEffect } from 'react';
import {
  Users,
  Crown,
  ShieldCheck,
  User,
  Eye,
  MoreVertical,
  UserMinus,
  Loader2,
  Clock,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface Member {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: OrgRole;
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  orgRole: OrgRole;
  expiresAt: string;
  createdAt: string;
}

interface MembersListProps {
  orgId: string;
  currentUserId: string;
  currentUserRole: OrgRole;
  onMemberUpdated?: () => void;
}

const ROLE_ICONS: Record<OrgRole, React.ReactNode> = {
  OWNER: <Crown className="h-4 w-4 text-yellow-500" />,
  ADMIN: <ShieldCheck className="h-4 w-4 text-blue-500" />,
  MEMBER: <User className="h-4 w-4 text-gray-500" />,
  VIEWER: <Eye className="h-4 w-4 text-gray-400" />,
};

const ROLE_COLORS: Record<OrgRole, string> = {
  OWNER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  MEMBER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  VIEWER: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
};

export function MembersList({
  orgId,
  currentUserId,
  currentUserRole,
  onMemberUpdated,
}: MembersListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<PendingInvite | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canManageMembers =
    currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const canChangeRole = (member: Member): boolean => {
    if (!canManageMembers) return false;
    if (member.userId === currentUserId) return false;
    if (member.role === 'OWNER' && currentUserRole !== 'OWNER') return false;
    return true;
  };

  const canRemoveMember = (member: Member): boolean => {
    if (!canManageMembers) return false;
    if (member.userId === currentUserId) return false;
    if (member.role === 'OWNER') return false;
    return true;
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/org/${orgId}/members`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      setError('Failed to load members');
    }
  };

  const fetchInvites = async () => {
    if (!canManageMembers) return;
    try {
      const response = await fetch(`/api/org/${orgId}/invites`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPendingInvites(data.invites || []);
      }
    } catch (err) {
      // Silently fail for invites
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMembers(), fetchInvites()]);
      setLoading(false);
    };
    loadData();
  }, [orgId]);

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    setActionLoading(memberId);
    try {
      const response = await fetch(`/api/org/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orgRole: newRole }),
      });

      if (response.ok) {
        await fetchMembers();
        onMemberUpdated?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update role');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setActionLoading(memberToRemove.id);
    try {
      const response = await fetch(
        `/api/org/${orgId}/members/${memberToRemove.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        await fetchMembers();
        onMemberUpdated?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove member');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
      setMemberToRemove(null);
    }
  };

  const handleRevokeInvite = async () => {
    if (!inviteToRevoke) return;

    setActionLoading(inviteToRevoke.id);
    try {
      const response = await fetch(
        `/api/org/${orgId}/invites/${inviteToRevoke.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        await fetchInvites();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to revoke invite');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
      setInviteToRevoke(null);
    }
  };

  const getInitials = (member: Member): string => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email[0].toUpperCase();
  };

  const getDisplayName = (member: Member): string => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return member.email.split('@')[0];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({members.length})
          </CardTitle>
          <CardDescription>
            Organization members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.profileImageUrl} />
                    <AvatarFallback>{getInitials(member)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {getDisplayName(member)}
                      {member.userId === currentUserId && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {member.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canChangeRole(member) ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.id, value as OrgRole)
                      }
                      disabled={actionLoading === member.id}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'] as OrgRole[])
                          .filter(
                            (r) =>
                              currentUserRole === 'OWNER' ||
                              (r !== 'OWNER' && r !== 'ADMIN')
                          )
                          .map((r) => (
                            <SelectItem key={r} value={r}>
                              <span className="flex items-center gap-2">
                                {ROLE_ICONS[r]}
                                {r}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={ROLE_COLORS[member.role]}>
                      <span className="flex items-center gap-1">
                        {ROLE_ICONS[member.role]}
                        {member.role}
                      </span>
                    </Badge>
                  )}

                  {canRemoveMember(member) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setMemberToRemove(member)}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canManageMembers && pendingInvites.length > 0 && (
            <>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Invites ({pendingInvites.length})
                </h4>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                          <div className="font-medium">{invite.email}</div>
                          <div className="text-sm text-muted-foreground">
                            Invited as {invite.orgRole}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInviteToRevoke(invite)}
                        disabled={actionLoading === invite.id}
                      >
                        {actionLoading === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Revoke'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{memberToRemove?.email}</strong> from this organization?
              They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!inviteToRevoke}
        onOpenChange={() => setInviteToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{' '}
              <strong>{inviteToRevoke?.email}</strong>? They will no longer be
              able to join using this invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvite}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
