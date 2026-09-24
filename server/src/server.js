// จุดเริ่มต้นของ Backend: เปิด HTTP server และจัดการ shutdown
import { app } from './app.js';
import { port } from './config/env.js';
import { prisma } from './config/prisma.js';

export const server = app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});

function shutdown() {
  server.close(async (error) => {
    await prisma.$disconnect();

    if (error) {
      console.error('Server shutdown error:', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
