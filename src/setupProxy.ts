import { createProxyMiddleware } from 'http-proxy-middleware';
import { Express } from 'express';

export default function setupProxy(app: Express) {
  app.use(
    '/text-to-speech',
    createProxyMiddleware({
      target: 'https://texttospeech.codewizzz.com',
      changeOrigin: true,
      secure: false,
    })
  );
  
  app.use(
    '/response-status',
    createProxyMiddleware({
      target: 'https://hindai.codewizzz.com/chat',
      changeOrigin: true,
      secure: false,
    })
  );
  app.use(
    '/initiate',
    createProxyMiddleware({
      target: 'https://hindai.codewizzz.com/chat',
      changeOrigin: true,
      secure: false,
    })
  );
}
