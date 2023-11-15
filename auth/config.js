const firebase = require('firebase-admin');

firebase.initializeApp({
	credential: firebase.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
	databaseURL: "https://scan-app-e5d3e.firebaseio.com",
});

module.exports = firebase;