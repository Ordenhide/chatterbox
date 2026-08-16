#!/bin/bash

echo "Optimizing iOS build configuration..."

# Enable dead code stripping
/usr/libexec/PlistBuddy -c "Set :DeadCodeStrip YES" "ios/chatterbox.xcodeproj/project.pbxproj" 2>/dev/null || echo "Could not set DeadCodeStrip"

# Enable optimization level for release
echo "To optimize iOS builds manually:"
echo "1. Open Xcode project"
echo "2. Select your target"
echo "3. Go to Build Settings"
echo "4. Set 'Optimization Level' to 'Fastest, Smallest [-Os]' for Release"
echo "5. Set 'Dead Code Stripping' to 'YES' for Release"
echo "6. Set 'Strip Debug Symbols During Copy' to 'YES' for Release"
echo "7. Set 'Strip Linked Product' to 'YES' for Release"
echo ""
echo "For Hermes optimization:"
echo "8. Set 'Enable Bitcode' to 'NO' (Hermes doesn't support bitcode)"
echo "9. Set 'Strip Style' to 'All Symbols' for Release"

echo "Optimization recommendations have been noted."
