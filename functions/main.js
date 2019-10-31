const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const main = express();

const firebase = require('./middleware/firebase');

main.use(cors({ origin: true })).use(firebase.verifyToken);

const { KubeConfig } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const Client = require('kubernetes-client').Client;

const setupKubeClient = (ip, token) => {
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromClusterAndUser(
    {
      server: `https://${ip}`,
      skipTLSVerify: true
    },
    {
      token
    }
  );

  return new Client({
    backend: new Request({ kubeconfig }),
    version: '1.13'
  });
};

// Given: token, decodedToken

main.get('/workloads', async (req, res) => {
  try {
    const {
      token,
      decodedToken: { uid }
    } = res.locals;

    const snapshot = await admin
      .database()
      .ref(`users/${uid}/deployments`)
      .once('value');
    const deployments = snapshot.val();
    if (!deployments) res.json({ clusters: {} });

    const clusters = [];

    await Promise.all(
      Object.keys(deployments).map(cid =>
        admin
          .database()
          .ref(`clusters/${cid}`)
          .once('value')
          .then(snapshot => {
            clusters.push({
              key: cid,
              cid,
              ...snapshot.val(),
              deployments: [],
              services: []
            });
          })
      )
    );

    const lowerUid = uid.toLowerCase();

    await Promise.all(
      clusters.map(cluster => {
        let kubeClient = setupKubeClient(cluster.addr, token);
        return Promise.all([
          kubeClient.apis.apps.v1
            .ns(lowerUid)
            .deployments.get()
            .then(deploymentList => {
              const items = deploymentList.body.items;
              for (const deployment of items) {
                const {
                  metadata: { name = '' },
                  spec: {
                    template: {
                      metadata: { labels = {} },
                      spec: { containers = [] }
                    }
                  },
                  status: {
                    replicas = 0,
                    conditions: [{ type = '' }]
                  }
                } = deployment;

                cluster.deployments.push({
                  key: name,
                  name,
                  labels,
                  containers,
                  replicas,
                  type
                });
              }
            }),
          kubeClient.api.v1
            .ns(lowerUid)
            .services.get()
            .then(serviceList => {
              const items = serviceList.body.items;
              for (const service of items) {
                const {
                  metadata: { name = '', labels = {} },
                  spec: { ports = [], selector = {}, clusterIP = '', type = '' }
                } = service;
                cluster.services.push({
                  key: name,
                  name,
                  labels,
                  ports,
                  selector,
                  clusterIP,
                  type
                });
              }
            })
        ]);
      })
    );

    res.json(clusters);
  } catch (error) {
    res.status(400).json({ err: error.message });
  }
});

module.exports = main;
