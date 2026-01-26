#!/bin/bash

# Insert a project at a specific order position
# Usage: ./insert_project.sh <position>
# Example: ./insert_project.sh 5  (makes room at order 5, shifts 5+ up)

PROJECTS_DIR="$(dirname "$0")"
POSITION=$1

if [ -z "$POSITION" ]; then
    echo "Usage: ./insert_project.sh <position>"
    echo "Example: ./insert_project.sh 5"
    exit 1
fi

echo "Making room at order position: $POSITION"
echo ""

# Find all project files and update order fields >= position
for file in "$PROJECTS_DIR"/project_*.md; do
    [ -f "$file" ] || continue

    # Extract current order value
    current_order=$(grep -E '^order:' "$file" | head -1 | sed 's/order:[[:space:]]*//')

    if [ -n "$current_order" ] && [ "$current_order" -ge "$POSITION" ]; then
        new_order=$((current_order + 1))
        echo "$(basename "$file"): order $current_order -> $new_order"

        # Update the order field in place
        sed -i '' "s/^order:[[:space:]]*$current_order/order: $new_order/" "$file"
    fi
done

echo ""
echo "Done! Position $POSITION is now available."
echo "Set 'order: $POSITION' in your new project file."
