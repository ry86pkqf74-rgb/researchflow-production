# UI Wiring Guide - ResearchFlow Frontend

**Last Updated**: January 27, 2026
**Status**: Track A & M Complete

---

## Overview

ResearchFlow uses a React frontend with:
- **Router**: `wouter` (lightweight React router)
- **State**: Zustand stores + TanStack Query
- **API**: `apiRequest` helper from `@/lib/queryClient`
- **UI**: shadcn/ui components
- **Build**: Vite

---

## File Structure

```
services/web/src/
├── App.tsx                     # Route definitions - ADD NEW ROUTES HERE
├── pages/                      # Page components
│   ├── manuscript-editor.tsx   # Track M: Manuscript Studio
│   ├── workflow.tsx
│   └── ... (other pages)
├── components/
│   ├── ui/                     # shadcn components
│   ├── stages/                 # Workflow stage components
│   ├── editor/                 # CollaborativeEditor, etc.
│   └── ...
├── hooks/                      # Custom React hooks
├── stores/                     # Zustand stores
├── lib/
│   └── queryClient.ts          # API helper + React Query client
└── i18n/                       # Internationalization
```

---

## How to Add a New Page/Route

### Step 1: Create Page Component

Create `services/web/src/pages/your-feature.tsx`:

```tsx
import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface YourFeatureData {
  id: string;
  name: string;
  // ... other fields
}

export default function YourFeaturePage() {
  const { id } = useParams();

  // Fetch data from backend
  const { data, isLoading, error } = useQuery({
    queryKey: ['your-feature', id],
    queryFn: () => apiRequest<YourFeatureData>(`/api/your-feature/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <Card className="p-6">
      <h1>{data?.name}</h1>
      {/* Your UI here */}
    </Card>
  );
}
```

### Step 2: Add Route to App.tsx

Add import at top of `services/web/src/App.tsx`:

```tsx
import YourFeaturePage from "@/pages/your-feature";
```

Add Route inside the `<Switch>` component (around line 300-400):

```tsx
<Route path="/your-feature">
  <AuthGate><YourFeaturePage /></AuthGate>
</Route>

{/* Or with params */}
<Route path="/your-feature/:id">
  <AuthGate><YourFeaturePage /></AuthGate>
</Route>
```

### Step 3: Add Navigation Link (Optional)

Update navigation in `services/web/src/components/nav/AdaptiveNavigation.tsx`:

```tsx
{
  href: "/your-feature",
  label: "Your Feature",
  icon: <YourIcon className="h-4 w-4" />,
}
```

---

## API Integration Pattern

### Using apiRequest

The `apiRequest` helper is defined in `services/web/src/lib/queryClient.ts`:

```tsx
import { apiRequest } from "@/lib/queryClient";

// GET request
const data = await apiRequest<ResponseType>('/api/endpoint');

// POST request
const result = await apiRequest<ResponseType>('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' }),
});

// With TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['feature', id],
  queryFn: () => apiRequest<DataType>(`/api/feature/${id}`),
});

// Mutation
const mutation = useMutation({
  mutationFn: (data: InputType) => apiRequest<OutputType>('/api/feature', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['feature'] });
  },
});
```

---

## Manuscript Studio UI Integration

### Routes (App.tsx lines 391-397)

```tsx
<Route path="/manuscripts/new">
  <AuthGate><ManuscriptEditorPage /></AuthGate>
</Route>
<Route path="/manuscripts/:id">
  <AuthGate><ManuscriptEditorPage /></AuthGate>
</Route>
```

### API Calls (manuscript-editor.tsx)

```tsx
// Fetch manuscript
const { data: manuscript } = useQuery({
  queryKey: ['manuscript', id],
  queryFn: () => apiRequest(`/api/manuscripts/${id}`),
});

// Generate section
const generateMutation = useMutation({
  mutationFn: ({ sectionId, options }) =>
    apiRequest(`/api/manuscripts/${id}/sections/${sectionId}/generate`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
});

// Save document
const saveMutation = useMutation({
  mutationFn: (content) =>
    apiRequest(`/api/manuscripts/${id}/doc/save`, {
      method: 'POST',
      body: JSON.stringify({ contentText: content }),
    }),
});
```

---

## Component Patterns

### Loading States

```tsx
import { Loader2 } from "lucide-react";

if (isLoading) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="ml-2">Loading...</span>
    </div>
  );
}
```

### Error Handling

```tsx
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

if (error) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
```

### Toast Notifications

```tsx
import { useToast } from "@/hooks/use-toast";

function MyComponent() {
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(data);
      toast({ title: "Saved successfully" });
    } catch (error) {
      toast({
        title: "Error saving",
        description: error.message,
        variant: "destructive"
      });
    }
  };
}
```

---

## State Management

### Zustand Stores

Located in `services/web/src/stores/`:

- `mode-store.ts` - DEMO/LIVE/OFFLINE mode
- `org-store.ts` - Organization context
- `workflow-store.ts` - Workflow state

Example usage:

```tsx
import { useModeStore } from "@/stores/mode-store";

function MyComponent() {
  const { isLive, isDemo } = useModeStore();

  return isLive ? <LiveFeature /> : <DemoFeature />;
}
```

---

## Auth & Mode Gates

### AuthGate

Wraps pages requiring authentication:

```tsx
<Route path="/protected">
  <AuthGate><ProtectedPage /></AuthGate>
</Route>
```

### Mode Checks

```tsx
import { useModeStore } from "@/stores/mode-store";

function MyComponent() {
  const { isLive, isDemo, isOffline } = useModeStore();

  if (isDemo) {
    return <DemoModeNotice />;
  }

  // Full functionality for LIVE/OFFLINE
  return <FullFeature />;
}
```

---

## Testing UI Changes

### Local Development

```bash
# Start web service in dev mode
cd services/web
pnpm dev

# Or via Docker
docker compose up web
```

### Verify in Browser

1. Open http://localhost:5173
2. Navigate to your new route
3. Check browser console for errors
4. Test API calls in Network tab

---

## Common Issues

### Route Not Found (404)

- Route not added to `App.tsx` `<Switch>`
- Path doesn't match exactly
- Missing leading `/` in path

### API Call Fails

- Backend route not mounted (see ROUTE_MOUNTING_GUIDE.md)
- CORS issue (check orchestrator CORS config)
- Auth token not sent (check apiRequest implementation)

### Component Not Rendering

- Import path incorrect
- Missing export default
- React error boundary caught exception

---

## Environment Variables

Frontend environment variables must be prefixed with `VITE_`:

```bash
# .env
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_COLLAB_URL=ws://localhost:1234
VITE_APP_MODE=DEMO
```

In code:

```tsx
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

---

## Build Process

```bash
# Development
pnpm dev

# Production build
pnpm build

# Preview production build
pnpm preview
```

Build output goes to `services/web/dist/` and is served by nginx in Docker.

---

## Track M Frontend Status

| Component | Status |
|-----------|--------|
| `/manuscripts/new` route | ✅ Exists |
| `/manuscripts/:id` route | ✅ Exists |
| `ManuscriptEditorPage` | ✅ Implemented |
| API integration | ⚠️ Needs update for new `/api/manuscripts` endpoints |
| Collaborative editing | ⚠️ Yjs ready but not fully wired |

---

**See Also:**
- `docs/ROUTE_MOUNTING_GUIDE.md` - Backend route mounting
- `docs/MANUSCRIPT_STUDIO_WIRING_AUDIT.md` - Full audit
- `docs/LOCAL_DEV.md` - Development setup
