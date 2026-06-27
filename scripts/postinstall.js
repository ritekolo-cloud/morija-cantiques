const { execSync } = require('child_process');

// Render sets RENDER_SERVICE_TYPE to 'static' for Static Sites
if (process.env.RENDER_SERVICE_TYPE === 'static') {
  console.log('Detected Render Static Site deployment. Skipping Prisma client generation.');
  process.exit(0);
}

console.log('Running postinstall Prisma client generation...');
try {
  execSync('npm run prisma:generate --workspace=@morija/backend', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to run Prisma generation:', error.message);
  process.exit(1);
}
