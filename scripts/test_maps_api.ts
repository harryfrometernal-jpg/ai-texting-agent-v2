import axios from 'axios';

const API_KEY = process.argv[2] || process.env.GOOGLE_MAPS_API_KEY;

async function main() {
    console.log('--- Testing Google Maps API Key ---');
    if (!API_KEY) {
        console.error("Please provide an API Key.");
        process.exit(1);
    }

    // New Places API (Text Search)
    const url = `https://places.googleapis.com/v1/places:searchText`;

    try {
        console.log(`Querying: ${url}`);
        const res = await axios.post(url, {
            textQuery: "Sushi in Austin"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating'
            }
        });

        // Response format is { places: [ ... ] }
        if (res.data.places && res.data.places.length > 0) {
            console.log("✅ Success! API Key is valid and Places API (New) is enabled.");
            console.log(`Found ${res.data.places.length} results.`);
            console.log("Top result:", res.data.places[0].displayName.text);
        } else if (res.data.error) {
            console.error("❌ API Error:", res.data.error);
        } else {
            console.log("Empty results, but API seems to work.");
        }
    } catch (error: any) {
        if (error.response) {
            console.error("❌ API Error:", error.response.data);
            if (error.response.data.error.status === 'PERMISSION_DENIED') {
                console.log("👉 Suggestion: Enable 'Places API (New)' in Google Cloud Console.");
            }
        } else {
            console.error("❌ Network Error:", error.message);
        }
    }
}

main();
