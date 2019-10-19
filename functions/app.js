const express = require('express');
const cors = require('cors');
const app = express();

const firebase = require('./middleware/firebase');
const uploadFileRouter = require('./routers/uploadFile');

app
  .use(cors({ origin: true }))
  .use(firebase.verifyToken)
  .use('/', uploadFileRouter)
  .use((err, req, res, next) => {
    res.status(400).json({ code: err.code, msg: err.message });
  });

module.exports = app;
