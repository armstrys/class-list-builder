#!/bin/bash
# Setup git hooks for code quality

echo "🔧 Setting up git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "🔍 Running pre-commit checks..."

# Check if package.json was modified but package-lock.json wasn't
if git diff --cached --name-only | grep -q "package.json" && ! git diff --cached --name-only | grep -q "package-lock.json"; then
    echo "⚠️  Warning: package.json modified but package-lock.json not updated"
    echo "   Run: npm install"
fi

# Check for console.log in staged JS files (excluding tests)
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM | grep "\.js$" | grep -v "test" | grep -v "\.test\." | head -20)
if [ -n "$STAGED_JS" ]; then
    CONSOLE_LOGS=$(grep -l "console\.log" $STAGED_JS 2>/dev/null | head -5)
    if [ -n "$CONSOLE_LOGS" ]; then
        echo "⚠️  Warning: console.log found in staged files:"
        echo "$CONSOLE_LOGS" | sed 's/^/   /'
    fi
fi

# Check bundle size threshold
if [ -f "dist/class-list-optimizer-v*.html" ]; then
    BUNDLE_SIZE=$(stat -f%z dist/class-list-optimizer-v*.html 2>/dev/null || stat -c%s dist/class-list-optimizer-v*.html 2>/dev/null)
    SIZE_MB=$(echo "scale=2; $BUNDLE_SIZE / 1024 / 1024" | bc)
    if (( $(echo "$SIZE_MB > 5.0" | bc -l) )); then
        echo "❌ Error: Bundle size (${SIZE_MB}MB) exceeds 5MB threshold"
        exit 1
    elif (( $(echo "$SIZE_MB > 3.0" | bc -l) )); then
        echo "⚠️  Warning: Bundle size (${SIZE_MB}MB) exceeds 3MB threshold"
    fi
fi

echo "✅ Pre-commit checks passed"
EOF

chmod +x .git/hooks/pre-commit

# Pre-push hook  
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
echo "🧪 Running pre-push tests..."

# Run tests
npm test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Push aborted."
    exit 1
fi

echo "✅ All tests passed"
EOF

chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "Hooks configured:"
echo "  • pre-commit: Checks for package-lock.json updates, console.log warnings, bundle size"
echo "  • pre-push: Runs full test suite"
