#!/bin/bash

echo "=== Validating GovernanceModeControl Implementation ==="
echo ""

echo "1. Checking GovernanceModeControl file exists..."
if [ -f "src/components/governance/GovernanceModeControl.tsx" ]; then
  echo "   ✓ GovernanceModeControl.tsx exists ($(wc -l < src/components/governance/GovernanceModeControl.tsx) lines)"
else
  echo "   ✗ GovernanceModeControl.tsx NOT FOUND"
  exit 1
fi

echo ""
echo "2. Checking deprecated files have deprecation comments..."
for file in "src/components/governance/DemoModeBanner.tsx" "src/components/governance/ModeIndicator.tsx" "src/components/mode/ModeBanner.tsx"; do
  if grep -q "@deprecated" "$file" 2>/dev/null; then
    echo "   ✓ $file has deprecation comment"
  else
    echo "   ✗ $file missing deprecation comment"
  fi
done

echo ""
echo "3. Checking index.ts exports..."
if grep -q "export.*GovernanceModeControl" src/components/governance/index.ts; then
  echo "   ✓ GovernanceModeControl exported from index.ts"
else
  echo "   ✗ GovernanceModeControl not exported from index.ts"
  exit 1
fi

echo ""
echo "4. Checking imports in updated files..."
files_to_check=("src/App.tsx" "src/pages/governance-console.tsx" "src/components/governance/BlockedActionModal.tsx")

for file in "${files_to_check[@]}"; do
  if grep -q "GovernanceModeControl" "$file"; then
    echo "   ✓ $file uses GovernanceModeControl"
  else
    echo "   ✗ $file does not use GovernanceModeControl"
  fi
done

echo ""
echo "5. Checking for any remaining direct imports of old components..."
old_imports=$(grep -r "from.*ModeBanner\|from.*ModeIndicator\|from.*DemoModeBanner" src --include="*.tsx" --exclude-dir=governance-console.tsx 2>/dev/null | grep -v "GovernanceModeControl" | grep -v ".tsx:import.*from \"./ModeBanner\"\|.tsx:import.*from \"./ModeIndicator\"\|.tsx:import.*from \"./DemoModeBanner\"" | wc -l)

if [ "$old_imports" -eq 0 ]; then
  echo "   ✓ No external imports of deprecated components found"
else
  echo "   ⚠ Found $old_imports import(s) of deprecated components (component files themselves may be importing)"
fi

echo ""
echo "=== Validation Complete ==="
