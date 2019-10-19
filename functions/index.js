const functions = require('firebase-functions');
const admin = require('firebase-admin');
const app = require('./app');
admin.initializeApp();

exports.processSignUp = functions.auth.user().onCreate(user => {
  return admin
    .auth()
    .setCustomUserClaims(user.uid, { groups: ['kubeko'] })
    .catch(err => console.log(err));
});
// Entry point to Express app that handles file upload
exports.uploadFile = functions.https.onRequest(app);
