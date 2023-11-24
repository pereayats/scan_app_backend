const express = require('express');
const { resolve } = require('path');
const fileUpload = require('express-fileupload');
const vision = require('@google-cloud/vision');
const algoliaearch = require('algoliasearch');
const { WebClient } = require('@slack/web-api');
const nodemailer = require('nodemailer');

const client = new WebClient();

const env_file = resolve(__dirname, './.env');
require('dotenv').config({ path: env_file });

const middleware = require('./auth/middleware')
const { addSlackIntegration, createNewUser } = require('./auth/functions')

const app = express();
app.use(express.json());
app.use(fileUpload());

const port = 3000;

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

app.use('/scan', middleware);
app.use('/create-admin', middleware);
app.use('/notify', middleware);

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

app.post('/create-admin', async (req, res) => {
    const displayName = req?.body?.displayName
    const email = req?.body?.email
    const password = req?.body?.password

    if (displayName && email && password) {
        createNewUser(displayName, email, password, (error, user_id) => {
            if (error) res.status(400).json({ error: error })
            else {
                let message = `You have been invited to manage some locations on Scan App. Here are your credentials:\n\n`;
                message += `email: ${email}\npassword: ${password}`

                const options = {
                    from: `Scan App <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: "Scan App Admin",
                    text: message
                }

                transporter.sendMail(options).then(info => {
                    res.status(200).json({ user_id: user_id });
                }).catch(error => {
                    res.status(400).json({ error: error })
                })
            }
        })
    }
    else res.status(400).json({ error: 'Missing Parameters' })
})

app.get('/integrate/slack', async (req, res) => {
    try {
        const response = await client.oauth.v2.access({
            client_id: process.env.SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            code: req.query.code,
        });

        await addSlackIntegration(req.query.state, response.access_token)
        res.status(200).send('Integration successful. Go back to the app.');
    }
    catch (error) {
        res.status(500).send('Something went wrong. Try again later.');
    }
})

app.post('/notify/email', async (req, res) => {
    let message = "A package has arrived for you and is waiting at the front office."
    if (req?.body?.message) message = req?.body?.message

    const options = {
        from: `Scan App <${process.env.EMAIL_USER}>`,
        to: req.body.to,
        subject: "A package has arrived",
        text: message
    }

    try {
        const info = await transporter.sendMail(options)
        res.status(200).json({ success: true })
    }
    catch (error) {
        res.status(400).json({ error: error })
    }
})

app.listen(port, () => console.log(`Server listening on port ${port}`));