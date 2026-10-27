const proxyConfig = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    headers: {
      origin: 'http://localhost:5173',
    },
  },
};

module.exports = proxyConfig;
