const firebase = require('./config');
const db = firebase.firestore()

async function addSlackIntegration(user_id, access_token) {
    try {
        const collectionRef = db.collection('slackIntegrations');
        await collectionRef.doc(user_id).set({ accessToken: access_token });
        return true;
    }
    catch (error) {
        console.log(error);
        return false;
    }
}

module.exports = {
    addSlackIntegration: addSlackIntegration
}