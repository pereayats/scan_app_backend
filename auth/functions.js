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

function createNewUser(displayName, email, password, callback) {
    firebase.auth().createUser({ email, password, displayName, emailVerified: true }).then(newUser => {
        callback(null, newUser?.uid)
    }).catch(error => {
        callback(error)
    })
}

module.exports = {
    addSlackIntegration: addSlackIntegration,
    createNewUser: createNewUser
}