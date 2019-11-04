const Busboy = require('busboy');

const processFiles = (req, res, next) => {
  try {
    res.locals.fields = {};
    res.locals.files = {};
    const busboy = new Busboy({ headers: req.headers });

    busboy.on('field', (fieldname, val) => {
      res.locals.fields[fieldname] = val;
    });

    buffers = {};
    busboy.on('file', (fieldname, file, filename) => {
      buffers[fieldname] = [];

      file.on('data', data => {
        buffers[fieldname].push(data);
      });

      file.on('end', () => {
        res.locals.files[fieldname] = Buffer.concat(
          buffers[fieldname]
        ).toString('utf8');
      });
    });

    busboy.on('finish', () => {
      next();
    });

    busboy.end(req.rawBody);
  } catch (error) {
    res.status(500);
    next(error);
  }
};

module.exports = {
  processFiles
};
