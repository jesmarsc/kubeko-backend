const functions = require('firebase-functions');
const admin = require('firebase-admin');
const app = require('./app');
admin.initializeApp();

// Entry point to Express app that handles file upload
exports.uploadFile = functions.https.onRequest(app);
