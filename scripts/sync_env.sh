#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo ".env file not found!"
    exit 1
fi

echo "Starting environment variable sync to Vercel..."

# Read .env file line by line
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^#.* ]] || [[ -z $key ]]; then
        continue
    fi
    
    # Remove any potential trailing spaces/newlines from value
    value=$(echo "$value" | xargs)
    
    # Skip NEXTAUTH_URL as Vercel handles this automatically or it should be the prod URL
    if [[ "$key" == "NEXTAUTH_URL" ]]; then
       echo "Skipping NEXTAUTH_URL (Managed by Vercel)..."
       continue
    fi

    echo "Adding $key..."
    # Pipe the value into the vercel env add command
    # Syntax: echo -n "value" | vercel env add KEY production
    echo -n "$value" | npx vercel env add "$key" production > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Added $key"
    else
        echo "⚠️  Failed to add $key (might already exist)"
    fi

done < .env

echo "Creating new deployment to apply changes..."
npx vercel --prod
