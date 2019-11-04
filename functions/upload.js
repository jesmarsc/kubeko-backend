const express = require('express');
const cors = require('cors');
const deployRouter = require('./routers/deploy');

const app = express();

app
  .use(cors({ origin: true }))
  .use('/', deployRouter)
  .use((err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  });

module.exports = app;
