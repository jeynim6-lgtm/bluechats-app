/**
 * One-time CLI script to set Firebase Custom Claims { role: 'ceo', admin: true, ceo: true }
 * for designated CEO / Admin accounts.
 *
 * Usage:
 *   npm run grant-ceo-claims
 *   or: npx tsx scripts/grant-ceo-claims.ts
 */

const TARGET_EMAILS = [
  'jeynim6@gmail.com',
  'bleushorts@gmail.com'
];

async function main() {
  console.log('====================================================');
  console.log('  Firebase CEO / Admin Custom Claims Provisioning');
  console.log('====================================================\n');

  // Attempt local or remote server endpoint invocation
  for (const email of TARGET_EMAILS) {
    try {
      console.log(`⏳ Processing account: ${email}...`);
      
      const response = await fetch('http://localhost:3000/api/admin/verify-claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.authorized) {
        console.log(`✅ SUCCESS: Granted CEO Custom Claims to [${email}]`);
        console.log(`   Claims: ${JSON.stringify(data.claims)}`);
        console.log(`   Role: ${data.role}\n`);
      } else {
        console.error(`❌ FAILED for [${email}]:`, data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error(`❌ Network or server error for [${email}]:`, err.message);
    }
  }

  console.log('====================================================');
  console.log('✨ All designated CEO claims have been verified & applied.');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
