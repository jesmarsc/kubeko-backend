const express = require('express');
const fsPromise = require('fs').promises;
const yaml = require('js-yaml');
const file = require('../middleware/file');
const admin = require('firebase-admin');

const { KubeConfig } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const Client = require('kubernetes-client').Client;

const router = express.Router();

const setupKubeClient = (ip, token) => {
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromClusterAndUser(
    {
      server: `https://${ip}`,
      skipTLSVerify: true,
    },
    {
      token,
    }
  );

  return new Client({
    backend: new Request({ kubeconfig }),
    version: '1.13',
  });
};

router.post(
  '/',
  file.saveAll,
  async (req, res, next) => {
    if (!res.locals.fields.ip) return next(new Error('Missing IP Address.'));
    if (Object.keys(res.locals.files).length === 0)
      return next(new Error('Missing File.'));

    const kubeClient = setupKubeClient(
      res.locals.fields.ip,
      req.headers.authorization.split(' ')[1]
    );

    const lowerCaseUid = res.locals.decodedToken.uid.toLowerCase();
    const k8s = {
      Deployment: kubeClient.apis.apps.v1.ns(lowerCaseUid).deployments,
      Service: kubeClient.api.v1.ns(lowerCaseUid).service,
      Namespace: kubeClient.api.v1.ns,
    };

    try {
      await k8s
        .Namespace(lowerCaseUid)
        .get()
        .catch(err =>
          k8s.Namespace.post({
            body: { metadata: { name: lowerCaseUid } },
          })
        );
      for (const filePath of Object.values(res.locals.files)) {
        const fileData = await fsPromise.readFile(filePath, 'utf-8');
        const resources = yaml.safeLoadAll(fileData);
        for (const resource of resources) {
          await k8s[resource.kind].post({ body: resource });
        }
        await fsPromise.unlink(filePath);
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  (req, res) => {
    res.json({ msg: 'Successful deployment!' });
  },
  file.cleanupOnError,
  (err, req, res, next) => {
    statusCode = !!err.code && typeof err.code === 'number' ? err.code : 500;
    res.status(statusCode).json({ err: err.message });
  }
);

module.exports = router;
