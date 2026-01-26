import { useState, useEffect } from 'react';
import { useOrgStore } from '../../stores/org-store';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

/**
 * Organization Selector Component (Task 102)
 *
 * Dropdown for switching between organizations. Shows:
 * - Organization name
 * - User's role in each org
 * - Checkmark for currently selected org
 *
 * Persists selection to backend session and local storage.
 */

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  subscriptionTier?: string;
}

export function OrgSelector() {
  const { org, setOrg } = useOrgStore();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch user's organizations on mount
    fetch('/api/org', { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setOrgs(data.organizations || data || []);
      })
      .catch(err => {
        console.error('[OrgSelector] Failed to fetch orgs:', err);
        setOrgs([]);
      });
  }, []);

  const handleSelect = async (orgId: string) => {
    if (loading || org?.id === orgId) {
      return;
    }

    setLoading(true);
    try {
      await setOrg(orgId);
      setOpen(false);
    } catch (error) {
      console.error('[OrgSelector] Failed to switch org:', error);
      // Could show toast notification here
    } finally {
      setLoading(false);
    }
  };

  // Hide if user has no orgs
  if (orgs.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-sm text-muted-foreground">
          No organizations available
        </p>
      </div>
    );
  }

  // Single org - show as static display
  if (orgs.length === 1) {
    return (
      <div className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-sm">{orgs[0].name}</span>
          <span className="text-xs text-muted-foreground">
            Role: {orgs[0].role}
          </span>
        </div>
      </div>
    );
  }

  // Multiple orgs - show selector
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          <span className="truncate">
            {org ? org.name : "Select organization..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandEmpty>No organization found.</CommandEmpty>

          <CommandGroup>
            {orgs.map((o) => (
              <CommandItem
                key={o.id}
                value={o.id}
                onSelect={() => handleSelect(o.id)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    org?.id === o.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium truncate">{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Role: {o.role}
                    {o.subscriptionTier && ` • ${o.subscriptionTier}`}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
