const express = require('express');
const cors = require('cors');
const proxy = require('http-proxy-middleware');
const firebaseWare = require('./middleware/firebase');

const app = express();

app.use(cors({ origin: true }));

const getClusterInfoWare = async (req, res, next) => {
  try {
    req.cluster = await firebaseWare.getClusterInfo(req.params.cid);
    next();
  } catch (error) {
    res.status(404);
    next(error);
  }
};

app.use(
  '/clusters/:cid',
  getClusterInfoWare,
  proxy({
    target: 'https://localhost',
    router: req => `https://${req.cluster.addr}`,
    pathRewrite: { '^/clusters/[^/]+': '' },
    changeOrigin: true,
    logLevel: 'silent'
  }),
  (err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  }
);

app.use(
  '/admin/clusters/:cid',
  firebaseWare.verifyToken,
  getClusterInfoWare,
  async (req, res, next) => {
    try {
      const {
        decodedToken: { uid }
      } = res.locals;
      if (uid === req.cluster.owner) {
        const adminToken = await firebaseWare.createCustomToken();
        req.headers.authorization = `Bearer ${adminToken}`;
        next();
      } else {
        throw new Error("You're not the owner of this cluster.");
      }
    } catch (error) {
      res.status(403);
      next(error);
    }
  },
  proxy({
    target: 'https://localhost',
    router: req => `https://${req.cluster.addr}`,
    pathRewrite: { '^/admin/clusters/[^/]+': '' },
    changeOrigin: true,
    logLevel: 'silent'
  }),
  (err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  }
);

module.exports = app;
