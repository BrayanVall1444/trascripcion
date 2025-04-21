/** next.config.js */
module.exports = {
    async rewrites() {
      return [
        {
          source: '/api/:path*',           // cualquier llamada a /api/...
          destination: 'http://localhost:8000/:path*'  // se reescribe a tu FastAPI
        }
      ]
    }
  }
  