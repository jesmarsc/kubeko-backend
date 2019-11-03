const express = require('express');
const cors = require('cors');
const app = express();

const firebaseWare = require('./middleware/firebase');
const deployRouter = require('./routers/deploy');

app
  .use(cors({ origin: true }))
  .use(firebaseWare.verifyToken)
  .use('/', deployRouter)
  .use((err, req, res, next) => {
    res.status(400).json({ code: err.code, msg: err.message });
  });

module.exports = app;
