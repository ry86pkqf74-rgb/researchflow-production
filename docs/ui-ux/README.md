# UI/UX Documentation

> Architecture and guidelines for ResearchFlow's user interface

## Overview

ResearchFlow's web interface is a React-based SPA built with:
- **Framework**: React 18 with TypeScript
- **Build**: Vite
- **State**: Zustand stores
- **Components**: shadcn/ui (Radix primitives)
- **Styling**: Tailwind CSS
- **Collaboration**: Y.js CRDT

## Component Library

### Core Components (74 total)

ResearchFlow uses a comprehensive component library based on shadcn/ui:

| Category | Components |
|----------|------------|
| **Form** | Input, Textarea, Select, Checkbox, Radio, Toggle, Calendar, Combobox |
| **Layout** | Card, Button, Badge, Alert, Breadcrumb, Sidebar, Sheet, Dialog |
| **Data** | Table, Pagination, Progress, Chart, Carousel |
| **Research** | Abstract Generator, Dataset Card, Fairness Metrics, IRB Panel, Manuscript Workspace |
| **Navigation** | Navigation Menu, Menubar, Command, Dropdown, Tabs |

### Component Usage

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function MyFeature() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Enter value..." />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

## State Management

### Zustand Stores

| Store | Purpose | Key State |
|-------|---------|-----------|
| `auth-store` | Authentication | user, token, permissions |
| `consent-store` | User consents | consents, grantConsent, revokeConsent |
| `governance-store` | Governance mode | mode, flags, isLiveMode |
| `dataset-store` | Dataset state | datasets, selected, loading |
| `mode-store` | UI mode | darkMode, sidebarOpen |
| `org-store` | Organization | currentOrg, members |

### Store Usage

```tsx
import { useAuthStore } from '@/stores/auth-store';
import { useGovernanceStore } from '@/stores/governance-store';

function ProtectedFeature() {
  const { user, isAuthenticated } = useAuthStore();
  const { mode, isLiveMode } = useGovernanceStore();

  if (!isAuthenticated) return <LoginPrompt />;
  if (!isLiveMode && requiresLive) return <DemoModeWarning />;

  return <Feature />;
}
```

## Feature Flags in UI

### Using Feature Flags

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function VoiceNavigation() {
  const voiceEnabled = useFeatureFlag('FEATURE_VOICE_COMMANDS');

  if (!voiceEnabled) return null;

  return <VoiceCommandPanel />;
}
```

### Conditional Rendering Patterns

```tsx
// Pattern 1: Early return
function Feature() {
  const enabled = useFeatureFlag('FEATURE_X');
  if (!enabled) return null;
  return <FeatureContent />;
}

// Pattern 2: Fallback content
function Feature() {
  const enabled = useFeatureFlag('FEATURE_X');
  return enabled ? <NewFeature /> : <LegacyFeature />;
}

// Pattern 3: Feature gate component
<FeatureGate flag="FEATURE_X" fallback={<ComingSoon />}>
  <NewFeature />
</FeatureGate>
```

## Theming

### Theme Provider

```tsx
import { ThemeProvider } from '@/components/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="rf-theme">
      <AppContent />
    </ThemeProvider>
  );
}
```

### Theme Modes

| Mode | Description |
|------|-------------|
| `light` | Light background, dark text |
| `dark` | Dark background, light text |
| `system` | Follow OS preference |

### CSS Variables

Theme tokens are defined as CSS variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## Role-Based UI

### Role Gate Component

```tsx
import { RoleGate } from '@/components/auth/RoleGate';

function AdminPanel() {
  return (
    <RoleGate allowedRoles={['ADMIN', 'STEWARD']}>
      <AdminSettings />
    </RoleGate>
  );
}
```

### Adaptive Layouts

| Role | UI Variant | Features |
|------|------------|----------|
| VIEWER | Simplified | Read-only, no exports |
| RESEARCHER | Full | All workflow stages |
| STEWARD | Full + Review | Approval queues, audit |
| ADMIN | Full + Admin | Settings, analytics |

## Collaboration Features

### Collaborative Editor

```tsx
import { CollaborativeEditor } from '@/components/editor/CollaborativeEditor';

function StageEditor({ artifactId }) {
  return (
    <CollaborativeEditor
      artifactId={artifactId}
      onSave={handleSave}
    />
  );
}
```

### Presence Indicators

```tsx
import { PresenceAvatars } from '@/components/collaboration/PresenceAvatars';

function DocumentHeader({ documentId }) {
  return (
    <div className="flex items-center">
      <h1>Document Title</h1>
      <PresenceAvatars documentId={documentId} />
    </div>
  );
}
```

## PHI UI Rules

### PHI-Safe Components

All UI components that display or collect data must:

1. **Never display raw PHI in DEMO mode**
2. **Use redaction overlays for sensitive fields**
3. **Audit log all PHI access attempts**
4. **Show clear indicators when PHI is present**

### PHI Preview Component

```tsx
import { PhiPreview } from '@/components/phi/PhiPreview';

function DataPreview({ data }) {
  return (
    <PhiPreview
      data={data}
      redactInDemo={true}
      showCategories={true}
    />
  );
}
```

### PHI Indicators

```tsx
// Visual indicator for PHI-containing content
<Badge variant="warning" className="ml-2">
  <ShieldAlert className="h-3 w-3 mr-1" />
  Contains PHI
</Badge>
```

## Accessibility

### Guidelines

- All interactive elements have focus states
- Color is not the only means of conveying information
- Sufficient color contrast (WCAG AA)
- Keyboard navigation support
- Screen reader friendly labels

### Accessibility Hooks

```tsx
import { useA11y } from '@/hooks/useA11y';

function Feature() {
  const { announceToScreenReader, trapFocus } = useA11y();

  const handleAction = () => {
    // Perform action
    announceToScreenReader('Action completed successfully');
  };

  return <div ref={trapFocus}>...</div>;
}
```

## Voice Navigation (Planned)

### Voice Commands

| Command | Action |
|---------|--------|
| "Go to stage [N]" | Navigate to stage |
| "Open artifacts" | Open artifact browser |
| "Open timeline" | Show project timeline |
| "Next stage" | Advance workflow |
| "Previous stage" | Go back |

### Voice Hook (Infrastructure)

```tsx
import { useVoiceRecorder } from '@/integrations/audio/useVoiceRecorder';

function VoiceInput() {
  const { isRecording, startRecording, stopRecording, transcript } = useVoiceRecorder();

  return (
    <Button onClick={isRecording ? stopRecording : startRecording}>
      {isRecording ? <MicOff /> : <Mic />}
    </Button>
  );
}
```

## Performance Guidelines

### Code Splitting

```tsx
// Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyChart />
    </Suspense>
  );
}
```

### Memoization

```tsx
// Memoize expensive computations
const processedData = useMemo(() => {
  return expensiveComputation(rawData);
}, [rawData]);

// Memoize callbacks
const handleClick = useCallback(() => {
  performAction(id);
}, [id]);
```

### Virtual Lists

```tsx
import { FixedSizeList } from 'react-window';

function LargeList({ items }) {
  return (
    <FixedSizeList
      height={400}
      itemCount={items.length}
      itemSize={50}
    >
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </FixedSizeList>
  );
}
```

## Testing

### Component Tests

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('navigation works', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Projects');
  await expect(page).toHaveURL(/\/projects/);
});
```

## Related Documentation

- [Feature Flags](./FEATURE_FLAGS.md)
- [PHI UI Rules](./PHI_UI_RULES.md)
- [Component Storybook](/storybook)
