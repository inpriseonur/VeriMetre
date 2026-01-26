
const axios = require('axios');

async function checkYahoo() {
    try {
        console.log("Fetching Yahoo Finance...");
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?interval=1d&range=1d';
        const response = await axios.get(url);
        const result = response.data?.chart?.result?.[0];

        if (result && result.meta) {
            console.log("Price:", result.meta.regularMarketPrice);
            console.log("Prev Close:", result.meta.chartPreviousClose);
        } else {
            console.log("Structure unexpected:", JSON.stringify(response.data));
        }
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.log("Status:", e.response.status);
        }
    }
}

checkYahoo();
