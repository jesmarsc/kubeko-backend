const express = require('express');
const cors = require('cors');
const app = express();

const firebase = require('./middleware/firebase');
const uploadFileRouter = require('./routers/uploadFile');

app
  .use(cors({ origin: true }))
  .use(firebase.verification)
  .use('/', uploadFileRouter);

module.exports = app;
