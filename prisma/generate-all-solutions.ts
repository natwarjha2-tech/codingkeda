/**
 * Generate best solutions for all 33 coding problems
 * Same logic as when user clicks "View Solution" — Gemini generates + stores in DB
 * 
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/generate-all-solutions.ts
 * REQUIRES: npm run dev running in another terminal
 */

async function main() {
  console.log("🚀 Generating best solutions for all coding problems...\n");

  // Step 1: Fetch all problems from local API
  const res = await fetch("http://localhost:3000/api/coding-problems");
  const data = await res.json();

  if (!data.success || !data.problems) {
    console.error("❌ Could not fetch problems. Make sure 'npm run dev' is running!");
    return;
  }

  const problems = data.problems;
  console.log(`📋 Found ${problems.length} problems. Generating solutions...\n`);

  let success = 0;
  let failed = 0;

  for (const p of problems) {
    process.stdout.write(`  [${success + failed + 1}/${problems.length}] ${p.title}...`);

    try {
      // Call the best-solution API — it will generate and store if not exists
      const solRes = await fetch(`http://localhost:3000/api/coding-problems/best-solution?problemId=${p.id}`);
      const solData = await solRes.json();

      if (solData.success) {
        console.log(" ✅ (stored)");
        success++;
      } else {
        console.log(" ⏳ (generating...)");
        // Wait longer for Gemini to generate 4-language solution
        await new Promise(r => setTimeout(r, 15000));
        const retry = await fetch(`http://localhost:3000/api/coding-problems/best-solution?problemId=${p.id}`);
        const retryData = await retry.json();
        if (retryData.success) {
          console.log("     ✅ Generated!");
          success++;
        } else {
          // One more try after longer wait
          await new Promise(r => setTimeout(r, 10000));
          const retry2 = await fetch(`http://localhost:3000/api/coding-problems/best-solution?problemId=${p.id}`);
          const retry2Data = await retry2.json();
          if (retry2Data.success) {
            console.log("     ✅ Generated (retry 2)!");
            success++;
          } else {
            console.log("     ❌ Failed");
            failed++;
          }
        }
      }
    } catch (e) {
      console.log(" ❌ Error");
      failed++;
    }

    // Delay between problems to respect Gemini rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\n🎉 Done! Success: ${success} | Failed: ${failed}`);
}

main().catch(e => console.error("❌ Error:", e));
