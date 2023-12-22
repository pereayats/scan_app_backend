const firebase = require('./config');
const db = firebase.firestore()
const { v4: uuidv4 } = require('uuid')

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

async function addLocationsForUser(user_id, num_locations) {
    try {
        const collectionRef = db.collection('userLocations');

        let locations = []
        for (var i = 0; i < num_locations; ++i) {
            locations.push({
                id: uuidv4(),
                name: `Location ${i+1}`
            })
        }

        await collectionRef.doc(user_id).set({ isSuper: true, locations: locations });
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
    addLocationsForUser: addLocationsForUser,
    createNewUser: createNewUser
}