import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const POTENTIAL_COLUMNS = [
  'company_name', 'status', 'expiry_date', 'plan_type', 'tier', 'document_url'
];

async function printErrors() {
  console.log("Printing error details for failing columns...");
  for (const col of POTENTIAL_COLUMNS) {
    const { data, error } = await supabase.from('startups').select(col).limit(1);
    if (error) {
      console.log(`Column '${col}':`);
      console.log(`  Code: ${error.code}`);
      console.log(`  Message: ${error.message}`);
      console.log(`  Details: ${error.details}`);
    } else {
      console.log(`Column '${col}' actually succeeded!`);
    }
  }
}

printErrors();
