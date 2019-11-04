const express = require('express');
const cors = require('cors');
const proxy = require('http-proxy-middleware');
const firebaseWare = require('./middleware/firebase');

const app = express();

app.use(cors({ origin: true }));

app.use(
  '/clusters/:cid',
  async (req, res, next) => {
    try {
      req.cluster = await firebaseWare.getClusterInfo(req.params.cid);
      next();
    } catch (error) {
      res.status(404);
      next(error);
    }
  },
  proxy({
    target: 'https://localhost',
    router: req => `https://${req.cluster.addr}`,
    pathRewrite: { '^/kubeko/us-central1/proxy/clusters/[^/]+': '' },
    changeOrigin: true,
    logLevel: 'silent'
  }),
  (err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  }
);

module.exports = app;
