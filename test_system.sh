#!/bin/bash
echo "🧪 Testing morning accountability system..."

# Test 1: Check cron job works
echo "Testing cron job..."
curl -s "https://ai-texting-agent.vercel.app/api/cron/process-scheduled"

echo -e "\n"

# Test 2: Send a task-related message
echo "Testing task message routing..."
curl -X POST https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming \
  -H "Content-Type: application/json" \
  -d '{
    "From": "+18569936360",
    "Body": "My daily goals for today: finish project proposal, workout 30 min, call mom",
    "contact_name": "Harry Castaner"
  }' -s

echo -e "\n✅ Test complete!"