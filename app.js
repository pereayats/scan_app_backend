const express = require('express');
const { resolve } = require('path');
const fileUpload = require('express-fileupload');
const vision = require('@google-cloud/vision');
const algoliaearch = require('algoliasearch');
const { WebClient } = require('@slack/web-api');

const client = new WebClient();

const env_file = resolve(__dirname, './.env');
require('dotenv').config({ path: env_file });

const middleware = require('./auth/middleware')
const { addSlackIntegration } = require('./auth/functions')

const app = express();
app.use(express.json());
app.use(fileUpload());

const port = 3000;

app.use('/scan', middleware);

app.post('/scan', async (req, res) => {
    console.log('hello')
    // We get the image sent in the request
    const image = req.files && req.files.file ? req.files.file : null;
    const location = req?.body?.location
    if (!location) res.status(400).json({ error: "Missing location" });
    else if (image) {
        try {
            console.log(image, location)
            // Google Cloud Vision integration
            const vision_credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            visionClient = new vision.ImageAnnotatorClient({ credentials: vision_credentials });

            // Trying to read the text from the package label
            const [result] = await visionClient.textDetection({ image: { content: image.data } });
            const labelText = result && result.textAnnotations.length > 0 ? result.textAnnotations[0].description : null;

            console.log(labelText)

            // Only if we find text we pass it through algolia
            if (labelText) {
                // Algolia integration
                const algoliaClient = algoliaearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
                const index = algoliaClient.initIndex(process.env.ALGOLIA_INDEX_NAME);

                // Searching for a employee directly on the database
                const algoliaResult = await index.search(labelText.replace(new RegExp("\n", "g"), " "), {
                    'removeWordsIfNoResults': 'allOptional'
                });

                console.log(algoliaResult.hits)

                if (algoliaResult.hits.length == 0) res.status(400).json({ error: 'No employee was found' });
                else {
                    res.status(200).json({ employees: algoliaResult.hits.filter(h => h.location == location) });
                }
            }
            else res.status(400).json({ error: 'No employee was found' });
        }
        catch (error) {
            console.log(error)
            res.status(400).json({ error: error.message });
        }
    }
    else res.status(400).json({ error: "Missing image" });
});

app.get('/integrate/slack', async (req, res) => {
    try {
        const response = await client.oauth.v2.access({
            client_id: process.env.SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            code: req.query.code,
        });

        await addSlackIntegration(req.query.state, response.access_token)
        res.status(200).send("<script>window.close()</script>");
    }
    catch (error) {
        res.status(500).send('Something went wrong. Try again later.');
    }
})

app.listen(port, () => console.log(`Server listening on port ${port}`));