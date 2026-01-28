# GovernanceModeControl Component Structure

## Architecture Overview

The `GovernanceModeControl` component uses a variant-based architecture to provide flexible governance mode display options. This document details the internal structure and variant implementations.

## File Structure

```
services/web/src/components/governance/
├── GovernanceModeControl.tsx          # Main consolidated component (461 lines)
├── DemoModeBanner.tsx                 # Deprecated (preserved)
├── ModeIndicator.tsx                  # Deprecated (preserved)
├── index.ts                           # Exports
└── (other governance components)

services/web/src/components/mode/
└── ModeBanner.tsx                     # Deprecated (preserved)

services/web/src/
├── App.tsx                            # Updated to use GovernanceModeControl
└── pages/
    └── governance-console.tsx         # Updated to use GovernanceModeControl
```

## Component Internal Structure

### Type Definitions

```typescript
// Mode configuration interface
interface ModeConfig {
  color: string;              // Tailwind color classes for text
  bgColor: string;            // Tailwind background color classes
  borderColor: string;        // Tailwind border color classes
  icon: typeof Lock;          // Lucide icon component
  label: string;              // Mode name (DEMO, LIVE, OFFLINE)
  description: string;        // Mode description
  allowedOperations: string[]; // List of permitted operations
}

// Mode-specific configurations
const MODE_CONFIGS: Record<GovernanceMode, ModeConfig> = {
  DEMO: {...},
  LIVE: {...},
  OFFLINE: {...}
};

// Landing pages where banner is hidden
const LANDING_PAGES = [
  "/", "/landing", "/demo", "/login", "/register",
  "/forgot-password", "/terms", "/privacy"
];
```

### Variant Components

The main component delegates to three specialized sub-components:

#### 1. BannerVariant
**Purpose**: Fixed-position or full-width banner for global visibility

**Key Features**:
- Dismissibility with localStorage persistence
- Optional mode switching integration
- Landing page exclusion logic
- Responsive layout with flex alignment
- Custom message support
- Role-aware visibility (unauthenticated/authenticated)

**Props Used**:
- `dismissible`: Enable dismiss button and localStorage
- `dismissKeyPrefix`: Custom localStorage key
- `enableModeSwitching`: Show "Switch to LIVE Mode" button
- `hideOnLandingPages`: Hide on specified pages
- `demoMessage`: Custom banner message

**Render Conditions**:
```
if (isLoading) → null
if (!isDemo || isDismissed) → null
if (hideOnLandingPages && LANDING_PAGES.includes(location)) → null
→ Render banner + optional ModeSwitcher
```

#### 2. IndicatorVariant
**Purpose**: Detailed expandable mode information card

**Key Features**:
- Collapsible card interface with expand/collapse animation
- Mode icon and description
- Operations list with bullet points
- Expandable details section
- Loading state with pulsing animation
- Full mode configuration display

**Props Used**:
- `showDetails`: Show/hide operations list and expand controls

**Internal State**:
- `isOpen`: Collapsible open/closed state

**Render Pattern**:
```
if (isLoading) → Loading badge
else → Card with:
  - Icon + label + description (always shown)
  - Expand/collapse chevron (if showDetails)
  - Collapsible content (if showDetails):
    - Operations list
    - Mode-specific guidance
```

#### 3. CompactVariant
**Purpose**: Minimal badge-style inline indicator

**Key Features**:
- Lightweight badge component
- Mode icon and label only
- Suitable for inline/sidebar use
- Click to toggle (for consistency)
- Minimal visual footprint

**Internal State**:
- `isOpen`: Unused but included for consistency

**Render Pattern**:
```
if (isLoading) → Loading badge
else → Colored badge with icon + mode label
```

### Mode Configuration Details

Each mode has specific configuration:

```typescript
DEMO: {
  color: "text-amber-600 dark:text-amber-400",
  bgColor: "bg-amber-500/10",
  borderColor: "border-amber-500/30",
  icon: Activity,
  label: "DEMO",
  description: "Demo mode - Synthetic data only",
  allowedOperations: [
    "View data (synthetic only)",
    "Run analyses (synthetic data)",
    "Generate drafts (watermarked)",
    "LLM calls (rate limited)",
    "View all features"
  ]
}

LIVE: {
  color: "text-green-600 dark:text-green-400",
  bgColor: "bg-green-500/10",
  borderColor: "border-green-500/30",
  icon: Unlock,
  label: "LIVE",
  description: "Live mode - Full operations enabled",
  allowedOperations: [
    "Upload data (with approval)",
    "Run full analyses",
    "Generate manuscripts",
    "Export results (with approval)",
    "LLM calls (tracked)",
    "Full feature access"
  ]
}

OFFLINE: {
  color: "text-amber-600 dark:text-amber-400",
  bgColor: "bg-amber-500/10",
  borderColor: "border-amber-500/30",
  icon: WifiOff,
  label: "OFFLINE",
  description: "Offline mode - AI disabled",
  allowedOperations: [
    "View data",
    "Manual data entry",
    "Run basic analyses",
    "Local operations only",
    "No AI assistance"
  ]
}
```

## Component Dependencies

### React Hooks
- `useState`: Managing dismissal state, collapsible state
- `useEffect`: Reading localStorage on mount
- `useLocation` (wouter): Getting current route

### Custom Hooks
- `useGovernanceMode()`: Get current mode and loading state
- `useAuth()`: Get authentication status for mode switching

### UI Components
- Button, Badge, Card, CardContent
- Collapsible, CollapsibleContent, CollapsibleTrigger
- Dialog (via ModeSwitcher)

### Icons (lucide-react)
- AlertTriangle, X, Lock, Unlock, Activity
- ChevronDown, ChevronUp, ArrowRight, Info
- Zap, WifiOff

## Data Flow

### Banner Variant Data Flow
```
App Load
  ↓
GovernanceModeControl (variant="banner")
  ↓
BannerVariant
  ├─ Check isLoading → null
  ├─ Check isDemo → null if not demo
  ├─ Check isDismissed → null if dismissed
  ├─ Check landing page → null if hiding enabled
  └─ Render banner + optional ModeSwitcher
     ├─ Get mode config from MODE_CONFIGS
     └─ On switch → Opens ModeSwitcher dialog
        ↓
        ModeSwitcher (external component)
        └─ Updates mode via useModeStore
```

### Indicator Variant Data Flow
```
GovernanceModeControl (variant="indicator")
  ↓
IndicatorVariant
  ├─ Check isLoading → Loading badge
  └─ Render card with mode info
     ├─ Get mode config
     ├─ Display icon + label + description
     ├─ If showDetails → Show expand trigger
     └─ On expand → Show operations list
```

### Compact Variant Data Flow
```
GovernanceModeControl (variant="compact")
  ↓
CompactVariant
  ├─ Check isLoading → Loading badge
  └─ Render badge
     └─ Get mode config
     └─ Display icon + label
```

## Styling Strategy

### Color System
The component uses Tailwind CSS with semantic colors:
- **Amber (DEMO/OFFLINE)**: Warning/limited functionality
- **Green (LIVE)**: Active/full functionality
- **Dark mode support**: Automatic via dark: prefix

### Layout
- Banner: Fixed positioning, full width (z-40)
- Indicator: Responsive card with flex layout
- Compact: Inline badge with flexible sizing

### Accessibility
- ARIA labels and semantic HTML
- `role="alert"` for banner
- Keyboard navigation via Collapsible component
- Screen reader text for icons

## Storage

### localStorage
- Key: `{dismissKeyPrefix}_dismissed`
- Default: `ros_governance_mode_dismissed`
- Value: String "true" when dismissed
- Persistence: Per origin (http://localhost vs deployed)

## Integration Points

### With useGovernanceMode Hook
Provides:
- `mode: GovernanceMode` (DEMO, LIVE, OFFLINE)
- `isDemo: boolean`
- `isLoading: boolean`

### With useAuth Hook
Provides:
- `isAuthenticated: boolean`
- Used for conditional display of mode switching

### With useLocation Hook
Provides:
- `location: string` (current URL path)
- Used for landing page exclusion

### With ModeSwitcher Component
- Opened when user clicks "Switch to LIVE Mode"
- Handles actual mode switching logic
- Updates global mode store

## Performance Considerations

1. **Minimal Re-renders**: Components only re-render when mode or auth state changes
2. **localStorage Optimization**: Only read once on mount, not on every render
3. **Conditional Rendering**: Early returns prevent unnecessary tree traversal
4. **Memoization**: UI components (Button, Badge, etc.) are library-memoized
5. **CSS Classes**: No inline styles, all Tailwind-based for optimal bundling

## Extensibility Points

1. **Custom Mode Configurations**: Modify `MODE_CONFIGS` for different modes
2. **Additional Variants**: Add new variant sub-components following the pattern
3. **Custom Landing Pages**: Update `LANDING_PAGES` array
4. **Storage Strategy**: Abstract localStorage into a custom hook
5. **Theme Integration**: Adapt color classes for custom theme systems

## Testing Strategy

### Unit Tests
- Test each variant independently
- Test dismissal state persistence
- Test mode detection logic
- Test landing page filtering

### Integration Tests
- Test mode switching workflow
- Test interaction with useGovernanceMode
- Test interaction with useAuth
- Test localStorage read/write

### E2E Tests
- Test banner visibility in different modes
- Test dismissal and re-appearance
- Test mode switching flow
- Test indicator expand/collapse

## Future Enhancement Opportunities

1. **Animation Enhancements**:
   - Smooth transitions for variant switches
   - Slide in/out animations for banner
   - Fade animations for operations list

2. **Extended Features**:
   - Toast notifications for mode changes
   - Inline mode switch widget
   - Mode history/audit trail display

3. **Customization**:
   - Theme color customization props
   - Custom icon support
   - Custom operation descriptions

4. **Accessibility**:
   - Keyboard shortcut support
   - Focus management improvements
   - ARIA live region announcements

5. **Analytics**:
   - Track mode switch attempts
   - Monitor dismissal behavior
   - Log variant usage patterns
