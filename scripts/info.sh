#!/bin/bash

stable_user_id=""
stable_version=""

if [ -d "$HOME/Library/Application Support/meetspace" ]; then
    if [ -f "$HOME/Library/Application Support/meetspace/store.json" ]; then
        stable_user_id=$(jq -r '."auth-user-id" // empty' "$HOME/Library/Application Support/meetspace/store.json")
    fi
fi

if [ -d "/Applications/Char.app" ]; then
    stable_version=$(defaults read /Applications/Char.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || echo "")
elif [ -d "/Applications/Meetspace.app" ]; then
    stable_version=$(defaults read /Applications/Meetspace.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || echo "")
fi

cat << EOF
{
    "stable": {
        "userId": "${stable_user_id}",
        "version": "${stable_version}"
    }
}
EOF
