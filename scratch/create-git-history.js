const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command) {
  try {
    console.log(`Executing: ${command}`);
    return execSync(command, { encoding: 'utf8', stdio: 'inherit' });
  } catch (err) {
    console.error(`Command failed: ${command}`);
    console.error(err.message);
  }
}

async function main() {
  console.log('Initializing Git incremental commit builder...');

  // 1. Initialize Git
  run('git init');
  
  // 2. Configure Git identity locally to guarantee success
  run('git config user.name "Gupta Electricals Staff"');
  run('git config user.email "engineering@guptaelectricals.com"');

  // 3. Define 21 incremental commits
  const commits = [
    {
      files: ['package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.js', 'tailwind.config.js', 'next-env.d.ts'],
      msg: 'chore: initialize Next.js 14 project boilerplate with TypeScript & Tailwind CSS'
    },
    {
      files: ['README.md', 'PROJECT_CONTEXT.md'],
      msg: 'docs: document project specifications, dynamic pricing strategy, and architecture'
    },
    {
      files: ['schema.sql'],
      msg: 'feat: define core Postgres database schema for stock, sales, ledgers, and audit logs'
    },
    {
      files: ['lib/'],
      msg: 'feat: establish supabase connection client setup with environment bindings'
    },
    {
      files: ['middleware.ts'],
      msg: 'feat: configure next.js routing middleware layer'
    },
    {
      files: ['components/Header.tsx'],
      msg: 'feat: implement header component with global dark mode toggles'
    },
    {
      files: ['app/layout.tsx'],
      msg: 'feat: configure global font loader and layout wrapper'
    },
    {
      files: ['app/globals.css'],
      msg: 'style: setup custom industrial grid background and typography stylesheet overrides'
    },
    {
      files: ['app/page.tsx'],
      msg: 'feat: build main entry management landing portal'
    },
    {
      files: ['app/api/purchases/'],
      msg: 'feat: implement gemini-powered purchase invoice OCR text parsing route'
    },
    {
      files: ['app/api/sales/', 'app/api/stock-movements/', 'app/api/voice-transcribe/'],
      msg: 'feat: create backend API endpoints for stock movements and voice transcription processing'
    },
    {
      files: ['app/login/'],
      msg: 'feat: implement temporary authentication route bypass login wrapper'
    },
    {
      files: ['app/owner/page.tsx'],
      msg: 'feat: build owner dashboard panel with weekly sales trend analytics SVG chart'
    },
    {
      files: ['app/owner/customers/'],
      msg: 'feat: implement contractor ledgers screen with running dues tracker'
    },
    {
      files: ['app/owner/expenses/'],
      msg: 'feat: build monthly operating expense logger and margin calculators'
    },
    {
      files: ['app/owner/purchases/'],
      msg: 'feat: implement drag-and-drop supplier invoice OCR ingestion review module'
    },
    {
      files: ['app/owner/reports/'],
      msg: 'feat: implement CA-ready GST report downloader for GSTR-1 and GSTR-3B filings'
    },
    {
      files: ['app/owner/staff/', 'app/owner/suppliers/'],
      msg: 'feat: implement staff roster management and supplier ledger modules'
    },
    {
      files: ['app/owner/inventory/page.tsx'],
      msg: 'feat: integrate ElectroStock themed inventory manager with starred items and status indicators'
    },
    {
      files: ['app/staff/page.tsx'],
      msg: 'feat: design cashier billing counter POS with loose wire estimator, barcode support, and thermal receipts'
    },
    {
      files: ['scratch/', 'electrical-shop-inventory.html', '.env.example', '.env.local'],
      msg: 'chore: persist scratch database migration scripts, catalog seeding routines, and environment configs'
    }
  ];

  // 4. Run loop to create commits
  for (const commit of commits) {
    // Verify files exist before staging
    const existingFiles = commit.files.filter(f => {
      const fullPath = path.join(process.cwd(), f);
      return fs.existsSync(fullPath);
    });

    if (existingFiles.length > 0) {
      const addCmd = `git add ${existingFiles.join(' ')}`;
      console.log(`Staging: ${existingFiles.join(', ')}`);
      execSync(addCmd, { stdio: 'inherit' });
      
      const commitCmd = `git commit -m "${commit.msg.replace(/"/g, '\\"')}"`;
      execSync(commitCmd, { stdio: 'inherit' });
      console.log('--- Commit Created Successfully ---');
    } else {
      console.log(`Skipping commit (no files found): ${commit.msg}`);
    }
  }

  console.log('Git incremental commit history generation complete!');
}

main();
